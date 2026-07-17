/**
 * Deterministischer, lokaler Tagesplaner fuer Serviceeinsaetze.
 *
 * Der Planer verwendet ausschliesslich die uebergebenen Daten. Entfernungen
 * werden per Haversine-Formel und einem transparenten Strassenfaktor
 * geschaetzt; es gibt weder Netzwerkzugriffe noch versteckte Seiteneffekte.
 */

const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.3;
const DEFAULT_DURATION_MIN = 60;
const DEFAULT_SPEED_KMH = 60;
const CLOSED_STATUSES = new Set([
    'DONE', 'CLOSED', 'CANCELLED', 'CANCELED',
    'ERLEDIGT', 'GESCHLOSSEN', 'STORNIERT', 'ABGESAGT'
]);

function normalizeText(value) {
    return String(value ?? '').normalize('NFKC').trim();
}

function normalizeToken(value) {
    return normalizeText(value).toLocaleUpperCase('de-DE');
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validDateKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeText(value));
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function dayNumber(dateKey) {
    if (!validDateKey(dateKey)) return null;
    const [year, month, day] = dateKey.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function parseClock(value, { allowEndOfDay = false } = {}) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(normalizeText(value));
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || hour > 24) return null;
    if (hour === 24) return allowEndOfDay && minute === 0 ? 1440 : null;
    return hour * 60 + minute;
}

function formatLocalMinute(workDate, minute) {
    if (!Number.isFinite(minute)) return null;
    const whole = Math.round(minute);
    const hour = Math.floor(whole / 60);
    const minutes = whole % 60;
    return `${workDate}T${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function parseDatePart(value) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(normalizeText(value));
    return match && validDateKey(match[1]) ? match[1] : null;
}

function parseSlaMinute(value, workDate) {
    const text = normalizeText(value);
    if (!text) return { minute: null, valid: true };

    const clockOnly = parseClock(text, { allowEndOfDay: true });
    if (clockOnly !== null) return { minute: clockOnly, valid: true };

    const match = /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{1,2}):(\d{2}))/.exec(text);
    if (!match || !validDateKey(match[1])) return { minute: null, valid: false };
    const clock = parseClock(`${match[2]}:${match[3]}`, { allowEndOfDay: true });
    if (clock === null) return { minute: null, valid: false };
    const relativeDay = dayNumber(match[1]) - dayNumber(workDate);
    return { minute: relativeDay * 1440 + clock, valid: true };
}

function parseSkills(value) {
    const source = Array.isArray(value)
        ? value
        : normalizeText(value).split(/[;,|]/);
    return [...new Set(source.map(normalizeToken).filter(Boolean))].sort();
}

function readPoint(value) {
    if (!value || value.lat === null || value.lat === undefined ||
        value.lng === null || value.lng === undefined ||
        normalizeText(value.lat) === '' || normalizeText(value.lng) === '') return null;
    const lat = Number(value.lat);
    const lng = Number(value.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
}

function airDistanceKm(a, b) {
    const radians = Math.PI / 180;
    const dLat = (b.lat - a.lat) * radians;
    const dLng = (b.lng - a.lng) * radians;
    const lat1 = a.lat * radians;
    const lat2 = b.lat * radians;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function travelLeg(a, b, speedKmh) {
    const km = airDistanceKm(a, b) * ROAD_FACTOR;
    const minutes = km <= 1e-9 ? 0 : Math.max(1, Math.round(km / speedKmh * 60));
    return { km, minutes };
}

function normalizePriority(value) {
    const token = normalizeToken(value).replace(/\s+/g, '');
    const serviceAliases = {
        KRITISCH: 'P1',
        HOCH: 'P2',
        MITTEL: 'P3',
        NIEDRIG: 'P4'
    };
    if (serviceAliases[token]) {
        const normalized = serviceAliases[token];
        return { value: normalized, rank: Number(normalized.slice(1)) - 1, defaulted: false };
    }
    const match = /^(?:P)?([1-4])$/.exec(token);
    if (match) return { value: `P${match[1]}`, rank: Number(match[1]) - 1, defaulted: false };
    return { value: 'P4', rank: 3, defaulted: Boolean(token) };
}

function dueTier(dayDiff) {
    if (dayDiff === null) return 3;
    if (dayDiff < 0) return 0;
    if (dayDiff === 0) return 1;
    return 2;
}

function slaTier(slaMinute, shiftStart, shiftEnd) {
    if (slaMinute === null) return 3;
    if (slaMinute < shiftStart) return 0;
    if (slaMinute <= shiftEnd) return 1;
    return 2;
}

function businessUrgencyKey(job, context) {
    return [
        slaTier(job.slaMinute, context.shiftStart, context.shiftEnd),
        job.priorityRank,
        dueTier(job.dueDayDiff),
        job.slaMinute ?? Number.POSITIVE_INFINITY,
        job.dueDayDiff ?? Number.POSITIVE_INFINITY
    ];
}

function compareValues(a, b) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
        if (a[i] === b[i]) continue;
        if (typeof a[i] === 'string' || typeof b[i] === 'string') {
            return String(a[i]).localeCompare(String(b[i]), 'de');
        }
        return a[i] < b[i] ? -1 : 1;
    }
    return 0;
}

function simulateOrder(order, context) {
    let currentPoint = context.start;
    let currentMinute = context.shiftStart;
    let totalKm = 0;
    let driveMin = 0;
    let waitMin = 0;
    let serviceMin = 0;
    const entries = [];

    for (const job of order) {
        const leg = travelLeg(currentPoint, job.point, context.averageSpeedKmh);
        const arrival = currentMinute + leg.minutes;
        const start = Math.max(arrival, job.windowStart);
        const end = start + job.durationMin;

        if (end > job.windowEnd) {
            return {
                feasible: false,
                violations: [{
                    code: 'time-window-missed',
                    jobId: job.id,
                    plannedEnd: formatLocalMinute(context.workDate, end),
                    latestEnd: formatLocalMinute(context.workDate, job.windowEnd)
                }]
            };
        }

        entries.push({ job, arrival, start, end, leg, waitMin: start - arrival });
        totalKm += leg.km;
        driveMin += leg.minutes;
        waitMin += start - arrival;
        serviceMin += job.durationMin;
        currentPoint = job.point;
        currentMinute = end;
    }

    const returnLeg = travelLeg(currentPoint, context.end, context.averageSpeedKmh);
    const finish = currentMinute + returnLeg.minutes;
    if (finish > context.shiftEnd) {
        return {
            feasible: false,
            violations: [{
                code: 'shift-end-exceeded',
                plannedReturn: formatLocalMinute(context.workDate, finish),
                latestReturn: formatLocalMinute(context.workDate, context.shiftEnd),
                excessMin: finish - context.shiftEnd
            }]
        };
    }

    return {
        feasible: true,
        entries,
        returnLeg,
        finish,
        totalKm: totalKm + returnLeg.km,
        driveMin: driveMin + returnLeg.minutes,
        waitMin,
        serviceMin
    };
}

function planPenalty(order, simulation, context) {
    let slaLateCount = 0;
    let slaLateMin = 0;
    for (const entry of simulation.entries) {
        if (entry.job.slaMinute !== null && entry.start > entry.job.slaMinute) {
            slaLateCount += 1;
            slaLateMin += entry.start - entry.job.slaMinute;
        }
    }

    let urgencyInversions = 0;
    for (let i = 0; i < order.length; i += 1) {
        for (let j = i + 1; j < order.length; j += 1) {
            if (compareValues(
                businessUrgencyKey(order[i], context),
                businessUrgencyKey(order[j], context)
            ) > 0) urgencyInversions += 1;
        }
    }
    return [slaLateCount, slaLateMin, urgencyInversions];
}

function assumptions(defaultDurationMin, averageSpeedKmh) {
    return [
        { code: 'local-time', value: 'workDate with local wall-clock times' },
        { code: 'distance-model', value: 'haversine-times-road-factor', roadFactor: ROAD_FACTOR },
        { code: 'average-speed-kmh', value: averageSpeedKmh },
        { code: 'default-duration-min', value: defaultDurationMin },
        { code: 'sla-is-soft', value: true, note: 'Overdue jobs remain planable.' },
        { code: 'planning-method', value: 'deterministic-urgency-first-feasible-insertion' }
    ];
}

function emptyMetrics(workDate, shiftStart, shiftEnd, unscheduledCount) {
    return {
        scheduledCount: 0,
        unscheduledCount,
        shiftMinutes: Number.isFinite(shiftStart) && Number.isFinite(shiftEnd)
            ? Math.max(0, shiftEnd - shiftStart)
            : 0,
        totalKm: 0,
        driveMin: 0,
        serviceMin: 0,
        waitMin: 0,
        returnKm: 0,
        returnDriveMin: 0,
        finishAt: null,
        utilizationPct: 0,
        workDate: validDateKey(workDate) ? workDate : null
    };
}

function globalFailure(jobs, code, details, settings) {
    const sorted = [...jobs]
        .map((job, index) => ({ job, index, id: normalizeText(job?.id) }))
        .sort((a, b) => a.id.localeCompare(b.id, 'de') || a.index - b.index);
    return {
        itinerary: [],
        unscheduled: sorted.map(({ job, id }) => ({
            jobId: id || null,
            customer: job?.customer ? { ...job.customer } : null,
            reasons: [{ code, ...details }]
        })),
        assumptions: assumptions(settings.defaultDurationMin, settings.averageSpeedKmh),
        metrics: emptyMetrics(settings.workDate, settings.shiftStart, settings.shiftEnd, sorted.length)
    };
}

function reasonForJob(job, entry, context) {
    const reasons = [{ code: 'priority', value: job.priority }];

    if (job.slaMinute !== null) {
        if (job.slaMinute < context.shiftStart) {
            reasons.push({ code: 'sla-overdue-before-shift', dueAt: job.slaDueAt });
        }
        if (entry.start > job.slaMinute) {
            reasons.push({
                code: 'sla-late',
                dueAt: job.slaDueAt,
                minutes: entry.start - job.slaMinute
            });
        } else {
            reasons.push({
                code: 'sla-within-target',
                dueAt: job.slaDueAt,
                slackMin: job.slaMinute - entry.start
            });
        }
    }

    if (job.dueDayDiff !== null) {
        reasons.push({
            code: job.dueDayDiff < 0
                ? 'due-overdue'
                : job.dueDayDiff === 0 ? 'due-today' : 'due-future',
            dueDate: job.dueDate,
            days: Math.abs(job.dueDayDiff)
        });
    }

    reasons.push(job.requiredSkills.length
        ? { code: 'skills-matched', skills: [...job.requiredSkills] }
        : { code: 'skills-not-required' });
    reasons.push({
        code: 'time-window-feasible',
        earliestStart: formatLocalMinute(context.workDate, job.windowStart),
        latestEnd: formatLocalMinute(context.workDate, job.windowEnd)
    });
    if (job.durationDefaulted) reasons.push({ code: 'default-duration-used', minutes: job.durationMin });
    if (job.priorityDefaulted) reasons.push({ code: 'unknown-priority-defaulted', value: 'P4' });
    if (!job.slaValid) reasons.push({ code: 'invalid-sla-ignored', value: job.slaDueAt });
    if (!job.dueValid) reasons.push({ code: 'invalid-due-date-ignored', value: job.dueDate });
    return reasons;
}

/**
 * Plant einen Service-Tag ohne Eingabedaten zu veraendern.
 *
 * Zeitfenster bedeuten: fruehester Arbeitsbeginn und spaetestes Arbeitsende.
 * Das SLA beeinflusst die Reihenfolge, ist aber keine harte Schranke.
 */
export function proposeServiceDay({
    jobs = [],
    start,
    end,
    workDate,
    shiftStart,
    shiftEnd,
    technicianSkills = [],
    defaultDurationMin = DEFAULT_DURATION_MIN,
    averageSpeedKmh = DEFAULT_SPEED_KMH
} = {}) {
    const inputJobs = Array.isArray(jobs) ? [...jobs] : [];
    const effectiveDefaultDuration = Number.isFinite(Number(defaultDurationMin)) && Number(defaultDurationMin) > 0
        ? Math.round(Number(defaultDurationMin))
        : DEFAULT_DURATION_MIN;
    const effectiveSpeed = Number.isFinite(Number(averageSpeedKmh)) && Number(averageSpeedKmh) > 0
        ? Number(averageSpeedKmh)
        : DEFAULT_SPEED_KMH;
    const shiftStartMin = parseClock(shiftStart);
    const shiftEndMin = parseClock(shiftEnd, { allowEndOfDay: true });
    const settings = {
        defaultDurationMin: effectiveDefaultDuration,
        averageSpeedKmh: effectiveSpeed,
        workDate,
        shiftStart: shiftStartMin,
        shiftEnd: shiftEndMin
    };

    if (!validDateKey(workDate)) {
        return globalFailure(inputJobs, 'invalid-work-date', { value: workDate ?? null }, settings);
    }
    if (shiftStartMin === null || shiftEndMin === null || shiftEndMin <= shiftStartMin) {
        return globalFailure(inputJobs, 'invalid-shift', {
            shiftStart: shiftStart ?? null,
            shiftEnd: shiftEnd ?? null
        }, settings);
    }

    const startPoint = readPoint(start);
    const endPoint = readPoint(end);
    if (!startPoint) return globalFailure(inputJobs, 'invalid-start-coordinates', {}, settings);
    if (!endPoint) return globalFailure(inputJobs, 'invalid-end-coordinates', {}, settings);

    const context = {
        start: startPoint,
        end: endPoint,
        workDate,
        shiftStart: shiftStartMin,
        shiftEnd: shiftEndMin,
        averageSpeedKmh: effectiveSpeed
    };
    const baseline = simulateOrder([], context);
    if (!baseline.feasible) {
        return globalFailure(inputJobs, 'end-unreachable-within-shift', {
            ...baseline.violations[0]
        }, settings);
    }

    const availableSkills = new Set(parseSkills(technicianSkills));
    const idCounts = new Map();
    for (const job of inputJobs) {
        const id = normalizeText(job?.id);
        if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }

    const sourceJobs = inputJobs
        .map((job, index) => ({ job: job ?? {}, index, id: normalizeText(job?.id) }))
        .sort((a, b) => a.id.localeCompare(b.id, 'de') || a.index - b.index);
    const candidates = [];
    const unscheduled = [];
    const workDayNumber = dayNumber(workDate);

    for (const source of sourceJobs) {
        const { job, id } = source;
        const customer = job.customer ? { ...job.customer } : null;
        const reject = (reason) => unscheduled.push({ jobId: id || null, customer, reasons: [reason] });

        if (!id) {
            reject({ code: 'missing-job-id' });
            continue;
        }
        if ((idCounts.get(id) ?? 0) > 1) {
            reject({ code: 'duplicate-job-id' });
            continue;
        }
        if (CLOSED_STATUSES.has(normalizeToken(job.status))) {
            reject({ code: 'inactive-status', status: job.status });
            continue;
        }

        const point = readPoint(job.customer);
        if (!point) {
            reject({ code: 'missing-or-invalid-customer-coordinates' });
            continue;
        }

        const requiredSkills = parseSkills(job.requiredSkills);
        const missingSkills = requiredSkills.filter((skill) => !availableSkills.has(skill));
        if (missingSkills.length) {
            reject({ code: 'missing-skills', skills: missingSkills });
            continue;
        }

        const hasWindowStart = normalizeText(job.timeWindowStart) !== '';
        const hasWindowEnd = normalizeText(job.timeWindowEnd) !== '';
        const rawWindowStart = hasWindowStart ? parseClock(job.timeWindowStart) : shiftStartMin;
        const rawWindowEnd = hasWindowEnd
            ? parseClock(job.timeWindowEnd, { allowEndOfDay: true })
            : shiftEndMin;
        if (rawWindowStart === null || rawWindowEnd === null) {
            reject({ code: 'invalid-time-window' });
            continue;
        }
        const windowStart = Math.max(shiftStartMin, rawWindowStart);
        const windowEnd = Math.min(shiftEndMin, rawWindowEnd);
        if (windowEnd <= windowStart) {
            reject({ code: 'time-window-outside-shift' });
            continue;
        }

        const rawDuration = Number(job.durationMin);
        const durationIsValid = job.durationMin !== null && job.durationMin !== undefined &&
            normalizeText(job.durationMin) !== '' && Number.isFinite(rawDuration) && rawDuration > 0;
        const durationMin = durationIsValid ? Math.round(rawDuration) : effectiveDefaultDuration;
        if (durationMin > windowEnd - windowStart) {
            reject({
                code: 'duration-exceeds-time-window',
                durationMin,
                availableMin: windowEnd - windowStart
            });
            continue;
        }

        const priority = normalizePriority(job.priority);
        const sla = parseSlaMinute(job.slaDueAt, workDate);
        const dueDate = parseDatePart(job.dueDate);
        const dueValid = normalizeText(job.dueDate) === '' || dueDate !== null;
        const dueDayDiff = dueDate === null ? null : dayNumber(dueDate) - workDayNumber;

        candidates.push({
            id,
            point,
            customer,
            status: job.status,
            durationMin,
            durationDefaulted: !durationIsValid,
            priority: priority.value,
            priorityRank: priority.rank,
            priorityDefaulted: priority.defaulted,
            requiredSkills,
            windowStart,
            windowEnd,
            slaMinute: sla.minute,
            slaDueAt: normalizeText(job.slaDueAt) || null,
            slaValid: sla.valid,
            dueDate: dueDate ?? (normalizeText(job.dueDate) || null),
            dueDayDiff,
            dueValid
        });
    }

    let order = [];
    let simulation = baseline;
    const remaining = new Map(candidates.map((job) => [job.id, job]));

    while (remaining.size) {
        let best = null;
        for (const job of remaining.values()) {
            for (let position = 0; position <= order.length; position += 1) {
                const proposedOrder = [...order.slice(0, position), job, ...order.slice(position)];
                const proposedSimulation = simulateOrder(proposedOrder, context);
                if (!proposedSimulation.feasible) continue;

                const score = [
                    ...businessUrgencyKey(job, context),
                    ...planPenalty(proposedOrder, proposedSimulation, context),
                    proposedSimulation.driveMin - simulation.driveMin,
                    proposedSimulation.waitMin,
                    proposedSimulation.finish,
                    job.id,
                    position
                ];
                if (!best || compareValues(score, best.score) < 0) {
                    best = { job, order: proposedOrder, simulation: proposedSimulation, score };
                }
            }
        }

        if (!best) break;
        order = best.order;
        simulation = best.simulation;
        remaining.delete(best.job.id);
    }

    for (const job of remaining.values()) {
        const solo = simulateOrder([job], context);
        const reasons = solo.feasible
            ? [
                { code: 'no-feasible-insertion' },
                { code: 'shift-capacity-kept-higher-urgency-jobs' }
            ]
            : solo.violations.map((violation) => ({ ...violation }));
        unscheduled.push({ jobId: job.id, customer: { ...job.customer }, reasons });
    }
    unscheduled.sort((a, b) => normalizeText(a.jobId).localeCompare(normalizeText(b.jobId), 'de'));

    const itinerary = simulation.entries.map((entry) => ({
        jobId: entry.job.id,
        customer: { ...entry.job.customer },
        arrival: formatLocalMinute(workDate, entry.arrival),
        start: formatLocalMinute(workDate, entry.start),
        end: formatLocalMinute(workDate, entry.end),
        driveMin: entry.leg.minutes,
        km: round(entry.leg.km),
        waitMin: entry.waitMin,
        durationMin: entry.job.durationMin,
        reasons: reasonForJob(entry.job, entry, context)
    }));
    const shiftMinutes = shiftEndMin - shiftStartMin;
    const occupiedMinutes = simulation.driveMin + simulation.waitMin + simulation.serviceMin;

    return {
        itinerary,
        unscheduled,
        assumptions: assumptions(effectiveDefaultDuration, effectiveSpeed),
        metrics: {
            scheduledCount: itinerary.length,
            unscheduledCount: unscheduled.length,
            shiftMinutes,
            totalKm: round(simulation.totalKm),
            driveMin: simulation.driveMin,
            serviceMin: simulation.serviceMin,
            waitMin: simulation.waitMin,
            returnKm: round(simulation.returnLeg.km),
            returnDriveMin: simulation.returnLeg.minutes,
            finishAt: formatLocalMinute(workDate, simulation.finish),
            utilizationPct: round(occupiedMinutes / shiftMinutes * 100),
            workDate
        }
    };
}
