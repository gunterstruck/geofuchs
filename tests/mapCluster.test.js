import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Karten-Cluster: Stapel erst ab 6 Kunden, darunter Einzelmarker', () => {
    const map = read('src/features/map.js');

    it('erzwingt eine Mindest-Stapelgröße von 6', () => {
        expect(map).toContain('const CUSTOMER_MIN_CLUSTER_SIZE = 6;');
        expect(map).toContain('minClusterSize: CUSTOMER_MIN_CLUSTER_SIZE');
    });

    it('zeigt bei zu kleinen Stapeln die einzelnen Kunden statt des Stapel-Icons', () => {
        // Eingriff an genau der Render-Stelle: kleiner Cluster → Einzelmarker.
        expect(map).toContain("L.MarkerCluster.prototype._addToMap");
        expect(map).toContain('this._childCount < minSize');
        expect(map).toContain('this.getAllChildMarkers()');
        expect(map).toContain('this._group._featureGroup.addLayer(m)');
    });

    it('verzichtet auf das frühere Auffächern beim Klick (kein Spinnennetz für ≤5)', () => {
        expect(map).not.toContain("a.layer.spiderfy()");
        expect(map).not.toContain('zoomToBoundsOnClick: false');
    });
});
