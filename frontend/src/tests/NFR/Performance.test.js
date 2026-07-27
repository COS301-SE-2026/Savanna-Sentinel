import http from 'k6/http'
import { sleep, check } from "k6"

const BASE_URL = "http://localhost:8000/v1"

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
        }
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<2000']
    }
}

//
export const base60HealthCheck = () => {
    const res = http.get(`${BASE_URL}/health`)

    check(res, {
        'is status 200': (r) => r.status === 200
    })

    sleep(1)
}
export const login6Check = () => {
    const payload = JSON.stringify({
        username: "ranger1",
        password: "SentinelSeed1!"
    })

    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/auth/login`, payload, params);

    check(res, {
        "login successful": (r) => r.status === 200
    });

    sleep(10)
}