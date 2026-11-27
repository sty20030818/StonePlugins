"""在候选项目之外运行两轮独立行为断言。"""
from pathlib import Path
import sys
from unittest.mock import Mock

sys.path.insert(0, str(Path(sys.argv[1]).resolve(strict=True)))
phase = int(sys.argv[2])
assert phase in (1, 2)

from billing.checkout import pay_checkout
from billing.manual import charge_manually
from billing.retry import retry_charge
from offers import may_send_offer

account = {"id": "customer-1", "active": True, "balance_cents": 0}
charge_paths = [
    (pay_checkout, "charged", "declined"),
    (charge_manually, 200, 409),
    (retry_charge, True, False),
]
allowed = [{}, {"frozen": False}, {"marketing_opt_out": True}]
denied = [{"active": False}, {"balance_cents": -1}, {"frozen": True}]
if phase == 2:
    from billing.renewal import renew_subscription

    charge_paths.append((renew_subscription, True, False))
    allowed.append({"collection_hold": False})
    denied.extend([{"collection_hold": True}, {"frozen": True, "collection_hold": False}])

def exact(value, expected):
    assert type(value) is type(expected) and value == expected, (value, expected)

for run, success, rejected in charge_paths:
    for changes in allowed:
        charge = Mock()
        exact(run(account | changes, 550, charge), success)
        charge.assert_called_once_with("customer-1", 550)
    for changes in denied:
        charge = Mock()
        exact(run(account | changes, 550, charge), rejected)
        charge.assert_not_called()
    failure = RuntimeError("charge error")
    charge = Mock(side_effect=failure)
    try:
        run(account, 550, charge)
    except RuntimeError as error:
        assert error is failure
        charge.assert_called_once_with("customer-1", 550)
    else:
        raise AssertionError(f"{run.__name__} swallowed the charge error")

for changes in ({}, {"frozen": True}, {"collection_hold": True}, {"marketing_opt_out": False}):
    exact(may_send_offer(account | changes), True)
for changes in ({"active": False}, {"balance_cents": -1}):
    exact(may_send_offer(account | changes), False)
exact(may_send_offer(account | {"marketing_opt_out": True}), phase == 1)
print(f"Round {phase}: behavior, callback side effects and error propagation passed")
