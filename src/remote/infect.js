/**
 * Remote: Infect
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1
    const destination = args['_'][1]

    const scp = ns.scp([
        '/hacks/check.js',
        '/hacks/grow.js',
        '/hacks/hack.js',
        '/hacks/infect.js',
        '/hacks/share.js',
        '/hacks/weaken.js',
        '/remote/infect.js',
        '/remote/get_player.js',
        '/remote/get_server.js',
        '/remote/get_servers.js',
        '/remote/hack_analyze.js',
        '/remote/growth_analyze.js',
        '/remote/get_purchased_server_cost.js',
        '/remote/purchase_server.js',
        '/remote/delete_server.js',
        '/remote/kill_all.js',
    ], destination, 'home')

    ns.writePort(port, JSON.stringify(scp))
}

/**
 * Command auto-complete
 * @param {Object} data
 * @param {*} args
 */
export function autocomplete(data, args) {
    return data.servers
}