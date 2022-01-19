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
    const serversReport = new ServersReport(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(serversReport.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await serversReport.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    // comment if using nsProxy
    ns.getPlayer()
    ns.fileExists()
    ns.scan()
    ns.getServer()
}

/**
 * ServersReport
 *
 * Gains root access on any available servers.
 */
export class ServersReport {

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
     * List of port cracks that have been unlocked
     * @type {Array}
     */
    ownedCracks

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
        this.ns.tprint('ServersReport...')
        await this.serversReport()
        // set the last run time
        this.lastRun = new Date().getTime()
        // display the report
        this.ns.tprint(this.getReport())
    }


    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async serversReport() {
        await this.loadPlayer()
        await this.loadCracks()
        await this.loadServers()
        this.ns.tprint(this.getReport())
    }

    /**
     * Report for the attack.
     *
     * @returns {string}
     */
    getReport() {

        // get unrooted servers
        let unrootedServers = this.servers
            .filter(s => !s.hasAdminRights)
        unrootedServers = unrootedServers.sort((a, b) => a.requiredHackingSkill - b.requiredHackingSkill)

        // get my servers
        const myServers = this.servers
            // include home//homenet-
            .filter(s => s.hostname === 'home' || s.hostname.includes(settings.purchasedServerPrefix))

        // get rootable servers
        const rootableServers = this.servers
            // exclude servers with root access
            .filter(s => !s.hasAdminRights)
            // include servers within hacking level and where we own enough port cracks
            .filter(s => s.requiredHackingSkill <= this.player.hacking && s.numOpenPortsRequired <= this.ownedCracks.length)

        // get rooted servers
        const rootedServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname !== 'home' && !s.hostname.includes('hacknet-') && !s.hostname.includes(settings.purchasedServerPrefix))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // get servers used for hacking
        const hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet-'))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        const ram = {
            max: hackingServers.map(s => s.maxRam).reduce((prev, next) => prev + next),
            used: hackingServers.map(s => s.ramUsed).reduce((prev, next) => prev + next),
        }

        const report = [
            '',
            '',
            '=======================',
            `|| 🖥 Servers Report ||`,
            '=======================',
            '',
            `${unrootedServers.length} locked servers:`,
            ` -> ${unrootedServers.map(s => s.hostname + ' = ' + s.requiredHackingSkill).join(', ')}`,
            '',
            `${myServers.length} owned servers:`,
            ` -> ${myServers.map(s => s.hostname + ' = ' + this.formatRam(s.ramUsed) + '/' + this.formatRam(s.maxRam)).join(', ')}`,
            '',
            `${rootedServers.length} pwnt servers:`,
            ` -> ${rootedServers.map(s => s.hostname + ' = ' + this.formatRam(s.ramUsed) + '/' + this.formatRam(s.maxRam) + ' ' + this.ns.nFormat(s.moneyAvailable, '$0.0a') + '/' + this.ns.nFormat(s.moneyMax, '$0.0a') + ' ' + this.ns.nFormat(s.hackDifficulty, '0.0a') + '/' + this.ns.nFormat(s.minDifficulty, '0.0a')).join(', ')}`,
            '',
            `Memory Usage`,
            ` -> ${this.ns.nFormat(ram.used / ram.max, '0%')} - ${this.formatRam(ram.used)}/${this.formatRam(ram.max)}`,
        ]
        if (rootableServers.length) {
            report.push('')
            report.push(`${rootableServers.length} servers are within hacking level (${this.player.hacking})`)
            report.push(` -> ${rootableServers.map(s => s.hostname).join(', ')}`)
        }

        return "\n\n" + report.join("\n") + "\n\n\n"
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
        // the ones we own
        this.ownedCracks = this.cracks
            .filter(a => a.owned)
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
            // reserve memory on home
            if (server.hostname === 'home') {
                server.ramUsed = Math.min(server.ramUsed + settings.reservedHomeRam, server.maxRam)
            }
            // add this server to the list
            this.servers.push(server)
        }

    }

    /**
     * Format RAM as string
     *
     * @param gb
     * @returns {string}
     */
    formatRam(gb) {
        return this.ns.nFormat(gb * 1000 * 1000 * 1000, '0.0b')
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
