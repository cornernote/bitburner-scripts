import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['proxy', false],
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
    let nsProxy = runner.nsProxy
    if (!args['proxy']) {
        nsProxy = ns
    }
    // load job module
    const rootServers = new RootServers(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(rootServers.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await rootServers.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
    // comment below here if using nsProxy
    ns.brutessh()
    ns.ftpcrack()
    ns.relaysmtp()
    ns.httpworm()
    ns.sqlinject()
    ns.nuke()
    ns.scp()
    ns.getPlayer()
    ns.fileExists()
    ns.scan()
    ns.getServer()
}

/**
 * RootServers
 *
 * Gains root access on any available servers.
 */
export class RootServers {

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The nsProxy instance
     * @type {NS}
     */
    nsProxy

    /**
     * The time we last ran
     * @type {Number}
     */
    lastRun

    /**
     * Player data
     * @type {Player}
     */
    player

    /**
     * Server data
     * @type {Server[]}
     */
    servers

    /**
     * List of port cracks that are used to root servers
     * @type {Array}
     */
    cracks

    /**
     * List of hacks that are used to attack servers
     * @type {Object}
     */
    hacks = {
        weaken: {
            script: '/hacks/weaken.js',
        },
        grow: {
            script: '/hacks/grow.js',
        },
        hack: {
            script: '/hacks/hack.js',
        },
    }

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {NS} nsProxy - the nsProxy object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, nsProxy, config = {}) {
        this.ns = ns
        this.nsProxy = nsProxy
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
    }

    /**
     * The main job function.
     *
     * @returns {Promise<void>}
     */
    async doJob() {
        // check if we need to run
        if (this.lastRun + settings.intervals['root-servers'] > new Date().getTime()) {
            return
        }
        // run
        this.ns.tprint('RootServers...')
        await this.rootServers()
        // set the last run time
        this.lastRun = new Date().getTime()
    }


    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async rootServers() {
        // refresh data
        await this.loadPlayer()
        await this.loadCracks()
        await this.loadServers()

        // get the cracks we own
        const ownedCracks = this.cracks
            .filter(a => a.owned)

        // get servers we can root
        const rootableServers = this.servers
            // exclude servers with root access
            .filter(s => !s.hasAdminRights)
            // include servers within hacking level and where we own enough port cracks
            .filter(s => s.requiredHackingSkill <= this.player.hacking && s.numOpenPortsRequired <= ownedCracks.length)

        // run owned port hacks on rootable servers
        for (const server of rootableServers) {
            // run port cracks
            for (const crack of ownedCracks) {
                await this.nsProxy[crack.method](server.hostname)
            }
            // run nuke
            await this.nsProxy['nuke'](server.hostname)
            // copy hack scripts
            await this.nsProxy['scp'](Object.values(this.hacks).map(h => h.script), server.hostname)
        }

    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.nsProxy['getPlayer']()
    }

    /**
     * Loads a list of port cracks.
     *
     * @returns {Promise<*[]>}
     */
    async loadCracks() {
        this.cracks = []
        const cracks = {
            brutessh: 'BruteSSH.exe',
            ftpcrack: 'FTPCrack.exe',
            relaysmtp: 'relaySMTP.exe',
            httpworm: 'HTTPWorm.exe',
            sqlinject: 'SQLInject.exe',
            // nuke: 'NUKE.exe', // not a port hack
        }
        for (const [method, exe] of Object.entries(cracks)) {
            this.cracks.push({
                method: method,
                exe: exe,
                owned: await this.nsProxy['fileExists'](exe, 'home'),
            })
        }
    }

    /**
     * Loads a list of servers in the network.
     *
     * @returns {Promise<*[]>}
     */
    async loadServers() {
        // get servers in network
        this.servers = []
        const spider = ['home']
        // run until the spider array is empty
        for (let i = 0; i < spider.length; i++) {
            const hostname = spider[i]
            // for all the connected hosts
            for (const scannedHostName of await this.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.nsProxy['getServer'](hostname)
            // add this server to the list
            this.servers.push(server)
        }
    }

    /**
     * Help text
     *
     * Player boss is stuck, let's get them some help.
     *
     * @returns {string}
     */
    getHelp() {
        return [
            '',
            '',
            'Gains root access on any available servers.',
            '',
            `USAGE: run ${this.ns.getScriptName()}`,
            '',
            'Example:',
            `> run ${this.ns.getScriptName()}`,
            '',
            '',
        ].join("\n")
    }

}
