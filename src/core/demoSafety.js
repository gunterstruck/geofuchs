export const DEMO_DATA_ORIGIN = 'tourfuchs-demo';
export const DEMO_DATA_LABEL = 'DEMO - NICHT PRODUKTIV';

const DRAMA_NUMBER_BLOCKS = [
    '030 23125',
    '069 90009',
    '040 66969',
    '0221 4710',
    '089 99998'
];

const DEMO_BRANCHES = new Set([
    'Autohaus', 'Bäckerei', 'Metallbau', 'Getränke', 'MedTech', 'Baustoffe',
    'Elektro', 'Logistik', 'Hotel', 'Feinkost', 'Werkzeuge', 'Maschinenbau',
    'Sanitär', 'Druckerei', 'Gartenbau', 'Fliesen', 'Dachdecker', 'Kfz-Service',
    'Textil', 'Optik'
]);

function text(value) {
    return String(value ?? '').trim();
}

function demoStatusFromExtra(customer) {
    const extra = customer?.extra || {};
    return text(extra.Datenstatus || extra['Datenstatus'] || extra.dataOrigin).toLowerCase();
}

export function isDemoCustomer(customer) {
    if (!customer) return false;
    const origin = text(customer.dataOrigin).toLowerCase();
    const name = text(customer.name).toLowerCase();
    const status = demoStatusFromExtra(customer);
    return customer.demo === true
        || origin === DEMO_DATA_ORIGIN
        || /^demo-\d+$/i.test(text(customer.id))
        || name.startsWith('tourfuchs demo ·')
        || status.startsWith('demo');
}

export function hasDemoCustomers(customers) {
    return (customers || []).some(isDemoCustomer);
}

export function isDemoDataset(customers) {
    return Boolean(customers?.length) && customers.every(isDemoCustomer);
}

function isDramaPhone(value) {
    const phone = text(value);
    return DRAMA_NUMBER_BLOCKS.some((prefix) => phone.startsWith(`${prefix} `)) && / \d{3}$/.test(phone);
}

export function demoCustomersNeedNormalization(customers) {
    return (customers || []).some((customer) => isDemoCustomer(customer) && (
        text(customer.dataOrigin) !== DEMO_DATA_ORIGIN
        || customer.demo !== true
        || !text(customer.name).startsWith('TourFuchs Demo ·')
        || text(customer.strasse) !== ''
        || text(customer.ansprechpartner) !== 'Demo-Team'
        || !isDramaPhone(customer.telefon)
        || !text(customer.email).endsWith('@example.com')
    ));
}

function demoIndex(customer, fallbackIndex = 0) {
    const idMatch = /^demo-(\d+)$/i.exec(text(customer?.id));
    if (idMatch) return Number(idMatch[1]);
    const number = Number.parseInt(text(customer?.nummer), 10);
    if (Number.isFinite(number) && number >= 20000) return number - 20000;
    return Math.max(0, Number(fallbackIndex) || 0);
}

function demoBranch(customer) {
    const explicit = text(customer?.demoBranch);
    if (DEMO_BRANCHES.has(explicit)) return explicit;
    const firstWord = text(customer?.name).split(/\s+/)[0];
    return DEMO_BRANCHES.has(firstWord) ? firstWord : 'Kunde';
}

export function demoPhone(index = 0) {
    const safeIndex = Math.max(0, Number(index) || 0);
    const prefix = DRAMA_NUMBER_BLOCKS[safeIndex % DRAMA_NUMBER_BLOCKS.length];
    const suffix = String(Math.floor(safeIndex / DRAMA_NUMBER_BLOCKS.length) % 1000).padStart(3, '0');
    return `${prefix} ${suffix}`;
}

export function demoEmail(index = 0) {
    return `kunde-${String(Math.max(0, Number(index) || 0) + 1).padStart(4, '0')}@example.com`;
}

export function demoCustomerIdentity(index = 0, branch = 'Kunde') {
    const safeIndex = Math.max(0, Number(index) || 0);
    const safeBranch = DEMO_BRANCHES.has(branch) ? branch : 'Kunde';
    return {
        name: `TourFuchs Demo · ${safeBranch} ${String(safeIndex + 1).padStart(4, '0')}`,
        ansprechpartner: 'Demo-Team',
        telefon: demoPhone(safeIndex),
        email: demoEmail(safeIndex),
        dataOrigin: DEMO_DATA_ORIGIN,
        demo: true,
        demoBranch: safeBranch
    };
}

/**
 * Migriert auch bereits lokal gespeicherte Alt-Demos. Objektidentitäten bleiben
 * erhalten, damit offene Touren und Kartenreferenzen nicht abbrechen.
 */
export function normalizeDemoCustomer(customer, fallbackIndex = 0) {
    if (!isDemoCustomer(customer)) return customer;
    const index = demoIndex(customer, fallbackIndex);
    const identity = demoCustomerIdentity(index, demoBranch(customer));
    Object.assign(customer, identity, {
        strasse: '',
        primaryContactId: `demo-contact-${index}`,
        contacts: [{
            id: `demo-contact-${index}`,
            name: identity.ansprechpartner,
            telefon: identity.telefon,
            email: identity.email,
            primary: true
        }]
    });
    return customer;
}

export function normalizeDemoCustomers(customers) {
    (customers || []).forEach((customer, index) => normalizeDemoCustomer(customer, index));
    return customers || [];
}
