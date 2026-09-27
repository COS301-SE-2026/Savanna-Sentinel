INTENTS = ("increase_risk", "decrease_risk", "prefer", "avoid")
RISK_INTENTS = ("increase_risk", "decrease_risk")
ROUTE_INTENTS = ("prefer", "avoid")

DEFAULT_RULE = {
    "enabled": True,
    "strength": 0.5,
    "buffer_decay": 0.0,
    "priority": 1,
}

MAX_RISK_DELTA = 0.3
AVOID_MAX = 50.0
PREFER_MIN = 0.4
ROUTE_MULT_MIN = 0.2
ROUTE_MULT_MAX = 100.0

MIN_WEIGHT = 1e-6
NEUTRAL_EPSILON = 1e-9
