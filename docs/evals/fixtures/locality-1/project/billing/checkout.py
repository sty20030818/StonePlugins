def pay_checkout(account, cents, charge):
    if not account["active"] or account["balance_cents"] < 0:
        return "declined"
    charge(account["id"], cents)
    return "charged"
