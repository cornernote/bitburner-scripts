import {Runner} from "./lib/Runner.js"
import {UpgradeHacknet} from "./upgrade-hacknet.js"
import {RootServers} from "./root-servers.js"
import {AttackServer} from "./attack-server.js"

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
    // load job module
    const upgradeHacknet = new UpgradeHacknet(ns, runner) // disabled as it costs too much ram, run on another thread
    const rootServers = new RootServers(ns, runner)
    const attackServer = new AttackServer(ns, runner)
    // print help
    if (args.help) {
        ns.tprint("\n\n\n" + [
            'Worker runs multiple jobs in a loop...',
            upgradeHacknet.getHelp(),
            rootServers.getHelp(),
            attackServer.getHelp(),
        ].join("\n\n\n"))
        ns.exit()
    }
    // work, sleep, repeat
    let home = await runner.nsProxy['getServer']('home');
    do {
        if ((home.maxRam - home.ramUsed) >= 16) {
            await upgradeHacknet.doJob();
        }
        await rootServers.doJob();
        await attackServer.doJob();
        await ns.sleep(10)
    } while (args['loop'])
    // spawn another task before we exit
    if (args['spawn']) {
        const runAfter = args['spawn'].split(' ');
        const script = runAfter.shift()
        ns.tprint(`starting ${script} with args ${JSON.stringify(runAfter)}`)
        ns.run(script, 1, ...runAfter); // use run instead of spawn, we already have run loaded, saves 2GB
    }
}

