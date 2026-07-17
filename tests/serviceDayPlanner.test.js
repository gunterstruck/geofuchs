import { describe, expect, it } from 'vitest';
import { proposeServiceDay } from '../src/features/serviceDayPlanner.js';

const ORIGIN = { lat: 0, lng: 0 };

function job(id, overrides = {}) {
    return {
        id,
        customer: { id: `customer-${id}`, lat: 0, lng: 0 },
        dueDate: '2026-07-17',
        durationMin: 30,
        priority: 'P3',
        requiredSkills: [],
        status: 'OPEN',
        ...overrides
    };
}

function plan(overrides = {}) {
    return proposeServiceDay({
        jobs: [],
        start: ORIGIN,
        end: ORIGIN,
        workDate: '2026-07-17',
        shiftStart: '08:00',
        shiftEnd: '17:00',
        technicianSkills: [],
        defaultDurationMin: 60,
        averageSpeedKmh: 60,
        ...overrides
    });
}

function reasonCodes(item) {
    return item.reasons.map((reason) => reason.code);
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
}

describe('proposeServiceDay', () => {
    it('liefert auch fuer einen leeren Tag ein stabiles Ergebnis', () => {
        const result = plan();

        expect(result.itinerary).toEqual([]);
        expect(result.unscheduled).toEqual([]);
        expect(result.metrics).toMatchObject({
            scheduledCount: 0,
            unscheduledCount: 0,
            totalKm: 0,
            driveMin: 0,
            finishAt: '2026-07-17T08:00:00'
        });
        expect(result.assumptions.map((entry) => entry.code)).toEqual([
            'local-time',
            'distance-model',
            'average-speed-kmh',
            'default-duration-min',
            'sla-is-soft',
            'planning-method'
        ]);
    });

    it('nutzt die Standarddauer transparent, ohne den Auftrag zu veraendern', () => {
        const input = deepFreeze({
            jobs: [job('A', { durationMin: undefined })],
            start: ORIGIN,
            end: ORIGIN,
            workDate: '2026-07-17',
            shiftStart: '08:00',
            shiftEnd: '10:00',
            technicianSkills: [],
            defaultDurationMin: 45,
            averageSpeedKmh: 60
        });

        const result = proposeServiceDay(input);

        expect(result.itinerary).toHaveLength(1);
        expect(result.itinerary[0]).toMatchObject({
            jobId: 'A',
            start: '2026-07-17T08:00:00',
            end: '2026-07-17T08:45:00',
            durationMin: 45
        });
        expect(reasonCodes(result.itinerary[0])).toContain('default-duration-used');
        expect(input.jobs[0].durationMin).toBeUndefined();
    });

    it('behandelt Qualifikationen als harte Bedingung und normalisiert Codes', () => {
        const result = plan({
            technicianSkills: ' s7 ; drive ',
            jobs: [
                job('MATCH', { requiredSkills: ['S7', 'DRIVE'] }),
                job('MISS', { requiredSkills: ['S7', 'HV'] })
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['MATCH']);
        expect(result.unscheduled).toHaveLength(1);
        expect(result.unscheduled[0].jobId).toBe('MISS');
        expect(result.unscheduled[0].reasons).toEqual([
            { code: 'missing-skills', skills: ['HV'] }
        ]);
    });

    it('wartet auf ein Zeitfenster und erlaubt dessen exakte Endgrenze', () => {
        const result = plan({
            shiftEnd: '10:00',
            jobs: [job('WINDOW', {
                timeWindowStart: '09:00',
                timeWindowEnd: '09:30',
                durationMin: 30
            })]
        });

        expect(result.itinerary[0]).toMatchObject({
            arrival: '2026-07-17T08:00:00',
            start: '2026-07-17T09:00:00',
            end: '2026-07-17T09:30:00',
            waitMin: 60
        });
        expect(result.metrics.waitMin).toBe(60);
    });

    it('verwirft einen Einsatz, wenn die Anfahrt das harte Zeitfenster sprengt', () => {
        const result = plan({
            shiftEnd: '10:00',
            jobs: [job('LATE', {
                customer: { id: 'customer-LATE', lat: 0, lng: 0.1 },
                timeWindowStart: '08:00',
                timeWindowEnd: '08:40',
                durationMin: 30
            })]
        });

        expect(result.itinerary).toEqual([]);
        expect(reasonCodes(result.unscheduled[0])).toContain('time-window-missed');
    });

    it('plant nur, wenn die Rueckkehr zum Endpunkt in die Schicht passt', () => {
        const distantJob = job('RETURN', {
            customer: { id: 'customer-RETURN', lat: 0, lng: 0.1 },
            durationMin: 30
        });

        const exact = plan({ jobs: [distantJob], shiftEnd: '08:58' });
        const tooShort = plan({ jobs: [distantJob], shiftEnd: '08:57' });

        expect(exact.itinerary).toHaveLength(1);
        expect(exact.metrics.finishAt).toBe('2026-07-17T08:58:00');
        expect(exact.metrics.driveMin).toBe(28);
        expect(exact.metrics.returnDriveMin).toBe(14);
        expect(exact.metrics.totalKm).toBeCloseTo(28.9, 1);
        expect(tooShort.itinerary).toEqual([]);
        expect(reasonCodes(tooShort.unscheduled[0])).toContain('shift-end-exceeded');
    });

    it('priorisiert P1 transparent vor einem gleichermassen faelligen P3-Einsatz', () => {
        const result = plan({
            shiftEnd: '10:00',
            jobs: [
                job('LOW', { priority: 'P3', durationMin: 20 }),
                job('HIGH', { priority: 'P1', durationMin: 20 })
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['HIGH', 'LOW']);
        expect(result.itinerary[0].reasons).toContainEqual({ code: 'priority', value: 'P1' });
    });

    it('versteht die Prioritaetswerte des Service-Imports als P1-bis-P4-Aliase', () => {
        const result = plan({
            shiftEnd: '10:00',
            jobs: [
                job('LOW', { priority: 'NIEDRIG', durationMin: 20 }),
                job('HIGH', { priority: 'KRITISCH', durationMin: 20 })
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['HIGH', 'LOW']);
        expect(result.itinerary[0].reasons).toContainEqual({ code: 'priority', value: 'P1' });
        expect(result.itinerary[1].reasons).toContainEqual({ code: 'priority', value: 'P4' });
    });

    it('plant einen bereits ueberfaelligen SLA-Auftrag weiterhin und zieht ihn vor', () => {
        const result = plan({
            shiftEnd: '10:00',
            jobs: [
                job('P1', { priority: 'P1', durationMin: 20 }),
                job('SLA', {
                    priority: 'P4',
                    slaDueAt: '2026-07-17T07:30',
                    durationMin: 20
                })
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['SLA', 'P1']);
        expect(reasonCodes(result.itinerary[0])).toContain('sla-overdue-before-shift');
        expect(reasonCodes(result.itinerary[0])).toContain('sla-late');
    });

    it('behaelt bei knapper Kapazitaet den Auftrag mit hoeherer Dringlichkeit', () => {
        const result = plan({
            shiftEnd: '09:00',
            jobs: [
                job('LOW', { priority: 'P4', durationMin: 40 }),
                job('HIGH', { priority: 'P1', durationMin: 40 })
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['HIGH']);
        expect(result.unscheduled[0].jobId).toBe('LOW');
        expect(reasonCodes(result.unscheduled[0])).toEqual([
            'no-feasible-insertion',
            'shift-capacity-kept-higher-urgency-jobs'
        ]);
    });

    it('waehlt bei gleicher Dringlichkeit und knapper Kapazitaet die kuerzere Route', () => {
        const result = plan({
            shiftEnd: '09:30',
            jobs: [
                job('A-FAR', {
                    customer: { id: 'customer-A-FAR', lat: 0, lng: 0.1 },
                    durationMin: 40
                }),
                job('Z-NEAR', { durationMin: 40 })
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['Z-NEAR']);
        expect(result.unscheduled[0].jobId).toBe('A-FAR');
    });

    it('schliesst ungueltige Koordinaten und abgeschlossene Auftraege aus', () => {
        const result = plan({
            jobs: [
                job('NO-GEO', { customer: { lat: null, lng: 7 } }),
                job('DONE', { status: 'erledigt' }),
                job('OPEN')
            ]
        });

        expect(result.itinerary.map((entry) => entry.jobId)).toEqual(['OPEN']);
        expect(result.unscheduled.map((entry) => entry.jobId)).toEqual(['DONE', 'NO-GEO']);
        expect(reasonCodes(result.unscheduled[0])).toEqual(['inactive-status']);
        expect(reasonCodes(result.unscheduled[1])).toEqual(['missing-or-invalid-customer-coordinates']);
    });

    it('liefert unabhaengig von der Eingabereihenfolge denselben Plan', () => {
        const jobs = [
            job('C', { priority: 'P3', durationMin: 20 }),
            job('A', { priority: 'P1', durationMin: 20 }),
            job('B', { priority: 'P2', durationMin: 20 })
        ];

        const forward = plan({ jobs });
        const reversed = plan({ jobs: [...jobs].reverse() });

        expect(reversed).toEqual(forward);
        expect(forward.itinerary.map((entry) => entry.jobId)).toEqual(['A', 'B', 'C']);
    });

    it('meldet doppelte und fehlende IDs statt mehrdeutig zu planen', () => {
        const result = plan({
            jobs: [job('DUP'), job('DUP'), job('', { customer: { lat: 0, lng: 0 } })]
        });

        expect(result.itinerary).toEqual([]);
        expect(result.unscheduled).toHaveLength(3);
        expect(reasonCodes(result.unscheduled[0])).toEqual(['missing-job-id']);
        expect(reasonCodes(result.unscheduled[1])).toEqual(['duplicate-job-id']);
        expect(reasonCodes(result.unscheduled[2])).toEqual(['duplicate-job-id']);
    });

    it('gibt bei ungueltigem Planungskontext fuer jeden Auftrag einen Grund zurueck', () => {
        const result = plan({
            jobs: [job('B'), job('A')],
            start: { lat: null, lng: 0 }
        });

        expect(result.itinerary).toEqual([]);
        expect(result.unscheduled.map((entry) => entry.jobId)).toEqual(['A', 'B']);
        expect(result.unscheduled.every((entry) =>
            reasonCodes(entry).includes('invalid-start-coordinates'))).toBe(true);
        expect(result.metrics.unscheduledCount).toBe(2);
    });
});
