import {Runner} from "./lib/Runner.js"
import {UpgradeHacknet} from "./upgrade-hacknet.js"
import {RootServers} from "./root-servers.js"
import {AttackServers} from "./attack-servers.js"

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
    let player = await runner.nsProxy['getPlayer']();
    const upgradeHacknet = new UpgradeHacknet(ns, ns, ns['hacknet']) // no proxy because .hacknet is too much ram for a background script if we only have 8gb
    const rootServers = new RootServers(ns, runner.nsProxy)
    const attackServers = new AttackServers(ns, runner.nsProxy)
    // print help
    if (args.help) {
        ns.tprint("\n\n\n" + [
            'Worker runs multiple jobs in a loop...',
            upgradeHacknet.getHelp(),
            rootServers.getHelp(),
            attackServers.getHelp(),
        ].join("\n\n\n"))
        ns.exit()
    }
    // work, sleep, repeat
    do {
        await upgradeHacknet.doJob();
        await rootServers.doJob();
        await attackServers.doJob();
        await ns.sleep(10)
    } while (args['loop'])
    // spawn another task before we exit
    if (args['spawn']) {
        const runAfter = args['spawn'].split(' ');
        const script = runAfter.shift()
        ns.tprint(`starting ${script} with args ${JSON.stringify(runAfter)}`)
        ns.run(script, 1, ...runAfter); // use run instead of spawn, we already have run() loaded, saves 2GB
    }
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
    ns.getPlayer() // adds 0.5gb, which is enough to run .hacknet locally
}
