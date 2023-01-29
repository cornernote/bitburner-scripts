import {filterHackingServers} from './lib/Server';
import {TargetSettings} from './lib/Target';
import {listView} from './lib/TermView';
import {getServersRemote} from './lib/Remote';

/**
 * Command options
 */
const argsSchema = [
    ['help', false],
    ['once', false]
]

/**
 * Share
 * Allow factions to use our memory.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // disable logs
    ns.disableLog('ALL')

    // load command arguments
    const args = ns.flags(argsSchema)

    // // load help
    // if (args['help'] || args['_'][0] === 'help') {
    //     ns.tprint('Help:\n' + helpInfo(ns, []))
    //     return
    // }

    do {
        const servers = await getServersRemote(ns, 'n00dles', 2)
        const hackingServers = filterHackingServers(servers).filter(s => s.hostname !== 'home')
        const ramPerThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/share.js').ram
        const totalThreads = hackingServers
            .map(s => Math.floor(s.maxRam / ramPerThread))
            .reduce((prev, next) => prev + next)


        // share resources
        const shareThreads = []
        for (const hackingServer of hackingServers) {
            const threads = Math.floor((hackingServer.maxRam - hackingServer.ramUsed) / ramPerThread)
            if (threads && threads / totalThreads > 0.01) {
                shareThreads.push({hostname: hackingServer.hostname, threads: threads})
                hackingServer.ramUsed += threads * ramPerThread
            }
        }
        if (shareThreads.length) {
            const end = new Date('2030-01-01')
            for (const st of shareThreads) {
                ns.exec('/hacks/share.js', st.hostname, st.threads, end.getTime())
                await ns.sleep(100)
            }
            ns.tprint('\n' + `Sharing threads` + '\n'
                + listView(shareThreads) + '\n'
                + 'Total Shared Threads: ' + shareThreads
                    .map(s => s.threads)
                    .reduce((prev, next) => prev + next) + '\n')
        }
        if (!args['once']) {
            await ns.sleep(60 * 1000)
        }
    } while (!args['once'])

}
