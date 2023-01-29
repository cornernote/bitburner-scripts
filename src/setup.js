import {filterHackingServers, filterRootableServers, getServers} from './lib/Server';
import {getCracks} from './lib/Target';
import {terminalCommand} from "./lib/Helper";




export async function main(ns) {
    // disable logs
    ns.disableLog('ALL')

    terminalCommand('alias info="run info.js"')
    terminalCommand('alias attack="run attack.js"')
    terminalCommand('alias share="run share.js"')
    terminalCommand('alias bd="run backdoor.js"')

    await runCracks(ns)
    await copyScripts(ns)

}

/**
 * Run cracks on all computers
 *
 * @param {NS} ns
 */
async function runCracks(ns) {
    const ownedCracks = getCracks(ns.fileExists).filter(c => c.owned)
    const rootableServers = filterRootableServers(getServers(ns.scan, ns.getServer), ns.getPlayer().skills.hacking, ownedCracks.length)
    if (rootableServers.length) {
        ns.tprint('\n=[ RUNNING CRACKS ]=\n' + rootableServers.map(s => s.hostname).join(', '))
        rootableServers.map(s => s.hostname).forEach(hostname => {
            for (const crack of ownedCracks) {
                ns[crack.method](hostname)
            }
            ns.nuke(hostname)
        })
    }

    function countedTowardsMemory(ns) {
        ns.brutessh('')
        ns.ftpcrack('')
        ns.relaysmtp('')
        ns.httpworm('')
        ns.sqlinject('')
    }
}

async function copyScripts(ns, hostname) {
    const hackingServers = filterHackingServers(getServers(ns.scan, ns.getServer)).filter(s => s.hostname !== 'home')
    if (hackingServers.length) {
        ns.tprint('\n=[ COPY SCRIPTS ]=\n' + hackingServers.map(s => s.hostname).join(', '))
        for (const hostname of hackingServers.map(s => s.hostname)) {
            if (!ns.run('/remote/infect.js', 1, 1, hostname)) {
                throw `cannot run '/remote/infect.js' on host ${hostname}`
            }
            await ns.sleep(100)
        }
    }
}