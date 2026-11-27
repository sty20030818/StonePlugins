def retry_charge(account, cents, charge):
    if not account["active"] or account["balance_cents"] < 0:
        return False
    charge(account["id"], cents)
    return True
