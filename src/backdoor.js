import {SERVER, getRoutes, getServers} from "./lib/Server";
import {terminalCommand} from "./lib/Helpers";

/**
 * Command options
 */
const argsSchema = [
    ['help', false],
]

/**
 * Command auto-complete
 * @param {Object} data
 * @param {*} args
 */
export function autocomplete(data, args) {
    data.flags(argsSchema)
    return ['all'].concat(data.servers)
}


/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')
    const args = ns.flags(argsSchema)

    const player = ns.getPlayer()

    let backdoorServers = getServers(ns).filter(s => s.hasAdminRights
        && !s.backdoorInstalled
        && !s.purchasedByPlayer
        && s.requiredHackingSkill <= player.hacking)

    if (args['_'][0]) {
        if (args['_'][0] !== 'all') {
            backdoorServers = backdoorServers.filter(s => s.hostname === args['_'][0])
        }
    } else {
        backdoorServers = backdoorServers.filter(s => SERVER.backdoorHostnames.includes(s.hostname))
    }

    if (backdoorServers.length) {
        const routes = getRoutes(ns)
        ns.tprint(`Backdoor: ${backdoorServers.map(s => s.hostname).join(', ')}.`)
        const commands = []
        for (const server of backdoorServers) {
            if (routes[server.hostname]) {
                routes[server.hostname].shift() // remove home
                commands.push(routes[server.hostname].map(r => `connect ${r}`).join(';') + ';backdoor')
                commands.push('home')
            }
        }
        for (const command of commands) {
            const terminalInput = terminalCommand(command)
            if (terminalInput) {
                while (terminalInput.disabled) {
                    await ns.sleep(200)
                    if (!globalThis['document'].getElementById('terminal-input')) {
                        break
                    }
                }
            }
        }
    }
}
