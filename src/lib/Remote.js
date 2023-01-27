import {ServerSettings} from './lib/Server';

export async function infectRemote(ns, hostname, host, port) {
    return await runRemote(ns, '/remote/infect.js', host, port, hostname)
}

export async function getPlayerRemote(ns, host, port) {
    return await runRemote(ns, '/remote/get_player.js', host, port)
}

export async function getServerRemote(ns, hostname, host, port) {
    return await runRemote(ns, '/remote/get_server.js', host, port, hostname)
}

export async function getServersRemote(ns, host, port) {
    return await runRemote(ns, '/remote/get_servers.js', host, port, ServerSettings.homeReservedRam, ServerSettings.remoteHostReservedRam)
}

export async function hackAnalyzeRemote(ns, hostname, host, port) {
    return await runRemote(ns, '/remote/hack_analyze.js', host, port, hostname)
}

export async function growthAnalyzeRemote(ns, host, port, hostname, cores) {
    return await runRemote(ns, '/remote/growth_analyze.js', host, port, hostname, cores)
}

export async function purchaseServerRemote(ns, hostname, ram, host, port) {
    return await runRemote(ns, '/remote/purchase_server.js', host, port, hostname, ram)
}

export async function deleteServerRemote(ns, hostname, host, port) {
    return await runRemote(ns, '/remote/delete_server.js', host, port, hostname)
}

export async function getPurchasedServerCostRemote(ns, ram, host, port) {
    return await runRemote(ns, '/remote/get_purchased_server_cost.js', host, port, ram)
}

export async function killAllRemote(ns, hostname, host, port) {
    return await runRemote(ns, '/remote/kill_all.js', host, port, hostname)
}

async function runRemote(ns, script, host, port, ...args) {
    host = host || 'n00dles'
    port = port || 1
    ns.clearPort(port)
    await ns.sleep(0)
    if (!ns.exec(script, host, 1, port, ...args)) {
        throw `cannot start script '${script}' on host ${host}`
    }
    for (let i = 0; i < 100; i++) {
        await ns.sleep(10)
        if (ns.peek(port) !== 'NULL PORT DATA') {
            const response = ns.readPort(port)
            // ns.print(`>>> read data from port ${port} for script '${script}' ran on host ${host}:`)
            // ns.print(response)
            return JSON.parse(String(response))
        }
    }
    throw `cannot read data from port ${port} for script '${script}' ran on host ${host}`
}
