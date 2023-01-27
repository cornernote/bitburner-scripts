/**
 * Remote: Get Purchased Server Cost
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1
    const ram = args['_'][1]

    const purchasedServerCost = ns.getPurchasedServerCost(ram)

    ns.writePort(port, JSON.stringify(purchasedServerCost))
}