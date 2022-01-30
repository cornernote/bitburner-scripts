import {getRoutes, getServers} from "./lib/Server";

/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const player = ns.getPlayer()
    const backdoorServers = getServers(ns).filter(s => s.hasAdminRights
        && !s.backdoorInstalled
        && !s.purchasedByPlayer
        && s.requiredHackingSkill <= player.hacking)
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
                }
            }
        }
    }
}

/**
 * Hacky way to run a terminal command
 *
 * @param message
 */
function terminalCommand(message) {
    const terminalInput = globalThis['document'].getElementById('terminal-input')
    if (terminalInput) {
        terminalInput.value = message
        const handler = Object.keys(terminalInput)[1]
        terminalInput[handler].onChange({target: terminalInput})
        terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null})
        return terminalInput
    }
}