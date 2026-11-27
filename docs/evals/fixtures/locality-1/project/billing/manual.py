def charge_manually(account, cents, charge):
    if not account["active"] or account["balance_cents"] < 0:
        return 409
    charge(account["id"], cents)
    return 200
