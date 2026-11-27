def may_send_offer(account):
    return account["active"] and account["balance_cents"] >= 0
