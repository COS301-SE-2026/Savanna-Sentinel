import http from 'k6/http'
import { sleep, check } from "k6"

const BASE_URL = "http://localhost:8000/v1"

const TEST_USERS = [
    { username: "ranger1", password: "SentinelSeed1!" },
    { username: "ranger2", password: "SentinelSeed1!" },
    { username: "ranger3", password: "SentinelSeed1!" },
    { username: "ranger4", password: "SentinelSeed1!" },
    { username: "ranger5", password: "SentinelSeed1!" },
    { username: "ranger6", password: "SentinelSeed1!" },
    { username: "ranger7", password: "SentinelSeed1!" },
    { username: "ranger8", password: "SentinelSeed1!" },
    { username: "ranger9", password: "SentinelSeed1!" },
    { username: "ranger10", password: "SentinelSeed1!" },
    { username: "ranger11", password: "SentinelSeed1!" },
    { username: "ranger12", password: "SentinelSeed1!" },
    { username: "ranger13", password: "SentinelSeed1!" },
    { username: "ranger14", password: "SentinelSeed1!" },
    { username: "ranger15", password: "SentinelSeed1!" },
]

export const options = {
    scenarios: {
        health_check_scenario: {
            executor: 'constant-vus',
            exec: 'base60HealthCheck',
            vus: 60,
            duration: '30s'
        },
        authentication_flow_check: {
            executor: 'constant-vus',
            exec: 'login6Check',
            vus: 6,
            duration: '1m'
        },
        report_submission_scenario: {
            executor: 'constant-vus',
            exec: 'submit15ReportCheck',
            vus: 15,
            duration: '30s'
        }
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000']
    }
}

export function setup() {
    const tokens = []

    for(const user of TEST_USERS){
        const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify(user), {
            headers: { "Content-Type": "application/json"}
        })

        const success = check(loginRes, {
            [`setup: authenticated ${user.username}`]: (r) => r.status === 200,
        })

        if(success){
            tokens.push(loginRes.json('access_token'))
        }
    }

    if (tokens.length === 0) {
        throw new Error('Setup failed: Could not authenticate any test users.');
    }

    return { tokens: tokens };
}

export const base60HealthCheck = () => {
    const res = http.get(`${BASE_URL}/health`)

    check(res, {
        'is status 200': (r) => r.status === 200
    })

    sleep(1)
}
export const login6Check = () => {
    const userIndex = (__VU - 1) % TEST_USERS.length;
    const payload = JSON.stringify(TEST_USERS[userIndex])

    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/auth/login`, payload, params);

    check(res, {
        "login successful": (r) => r.status === 200
    });

    sleep(10)
}

export const submit15ReportCheck = (data) => {
    const tokenIndex = (__VU - 1) % data.tokens.length;
    const currentToken = data.tokens[tokenIndex]

    const isIncident = Math.random() < 0.5;
    const nowISO = new Date().toISOString();

    const basePayload = {
        occurred_at: nowISO,
        location: {
            lat: -25.7 + (Math.random() * 0.1),
            lon: 28.1 + (Math.random() * 0.1),
        },
        description: `Automated k6 ${isIncident ? 'incident' : 'sighting'} report submitted at ${nowISO}`,
    }

    let reportPayload;

    if(isIncident){
        const incidentTypes = [
            'Snare Found',
            'Gunshot Heard',
            'Suspicious Tracks',
            'Suspicious Person',
            'Carcass Found',
            'Vehicle Tracks',
            'Other'
        ];
        const severities = ['low', 'medium', 'high'];

        reportPayload = {
            ...basePayload,
            report_type: 'incident',
            //images:[],
            incident_type: incidentTypes[Math.floor(Math.random() * incidentTypes.length)],
            severity: severities[Math.floor(Math.random() * severities.length)],
        }
    }
    else{
        const speciesList = [
            'Elephant',
            'Rhino',
            'Lion',
            'Leopard',
            'Buffalo',
            'Other'
        ]

        reportPayload = {
            ...basePayload,
            report_type: 'sighting',
            species: speciesList[Math.floor(Math.random() * speciesList.length)],
            count: Math.floor(Math.random() * 5) + 1,
        };
    }

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
        }
    }

    const res = http.post(`${BASE_URL}/reports`, JSON.stringify(reportPayload), params)

    check(res, {
        'report created (201)': (r) => r.status === 201,
        'has_report_id': (r) => r.json('report_id') !== undefined
    })

    sleep(2);
}