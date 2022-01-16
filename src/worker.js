import {Runner} from "./lib/Runner.js"
import {BuyCracks} from "./buy-cracks.js"
import {UpgradeHacknet} from "./upgrade-hacknet.js"
import {RootServers} from "./root-servers.js"
import {AttackServers} from "./attack-servers.js"
import {HostManager} from "./host-manager"
import {PortReader} from "./port-reader"
import {HackingStats} from "./hacking-stats";

/**
 * Command options
 */
const argsSchema = [
    ['loop', false], // if we should loop
    ['spawn', ''], // name of a script to spawn after this
    ['help', false],
]

/**
 * Command auto-complete
 */
export function autocomplete(data, _) {
    data.flags(argsSchema)
    return []
}

/**
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const args = ns.flags(argsSchema)
    const runner = new Runner(ns)
    // load job modules
    //let player = await runner.nsProxy['getPlayer']()
    const buyCracks = new BuyCracks(ns, runner.nsProxy)
    const upgradeHacknet = new UpgradeHacknet(ns, ns, ns['hacknet']) // no proxy because .hacknet is too much ram for a background script if we only have 8gb
    const rootServers = new RootServers(ns, runner.nsProxy)
    const hostManager = new HostManager(ns, runner.nsProxy)
    const attackServers = new AttackServers(ns, runner.nsProxy)
    const portReader = new PortReader(ns, runner.nsProxy)
    const hackingStats = new HackingStats(ns, runner.nsProxy)
    // print help
    if (args.help) {
        ns.tprint("\n\n\n" + [
            'Worker runs multiple jobs in a loop...',
            buyCracks.getHelp(),
            upgradeHacknet.getHelp(),
            rootServers.getHelp(),
            hostManager.getHelp(),
            attackServers.getHelp(),
            portReader.getHelp(),
            hackingStats.getHelp(),
        ].join("\n\n\n"))
        ns.exit()
    }
    // work, sleep, repeat
    do {
        localStorage.clear() // clear each loop so localstorage doesn't overflow
        await buyCracks.doJob()
        await upgradeHacknet.doJob()
        await rootServers.doJob()
        await hostManager.doJob()
        await attackServers.doJob()
        await portReader.doJob()
        await hackingStats.doJob()
        await ns.sleep(10)
    } while (args['loop'])
    // spawn another task before we exit
    if (args['spawn']) {
        const runAfter = args['spawn'].split(' ')
        const script = runAfter.shift()
        ns.tprint(`starting ${script} with args ${JSON.stringify(runAfter)}`)
        ns.run(script, 1, ...runAfter) // use run instead of spawn, we already have run() loaded, saves 2GB
    }
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
    // adds 0.5gb, which is enough to run .hacknet locally
    ns.getPlayer()
    // uncomment if you want to be legit about ram used, however it wont run background scripts if you have only 8gb
    //ns.hacknet.numNodes()
}
