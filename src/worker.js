import {Runner} from "./lib/Runner.js"
import {UpgradeHacknet} from "./upgrade-hacknet.js"
import {RootServers} from "./root-servers.js"
import {AttackServer} from "./attack-server.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
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
    const upgradeHacknet = new UpgradeHacknet(ns, runner)
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
    do {
        await upgradeHacknet.doJob();
        await rootServers.doJob();
        await attackServer.doJob();
        await ns.sleep(10)
    } while (args.loop)
}

