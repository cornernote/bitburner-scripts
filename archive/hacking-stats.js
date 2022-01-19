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
    const hackingStats = new HackingStats(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(hackingStats.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await hackingStats.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    // comment if using nsProxy
    ns.fileExists()
    ns.getPlayer()
    ns.getServer()
}

/**
 * HackingStats
 *
 * Shows stats about hacking amounts.
 */
export class HackingStats {

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
        if (this.lastRun + settings.intervals['hacking-stats'] > new Date().getTime()) {
            return
        }
        // run
        //this.ns.tprint('HackingStats...')
        await this.hackingStats()
        // set the last run time
        this.lastRun = new Date().getTime()
    }

    /**
     * Shows stats about hacking amounts.
     *
     * @returns {Promise<void>}
     */
    async hackingStats() {
        await this.loadPlayer()
        const statsContents = this.ns.read('/data/stats.json.txt')
        const stats = statsContents
            ? JSON.parse(statsContents)
            : {}
        const attacksContents = this.ns.read('/data/attacks.json.txt')
        const attacks = attacksContents
            ? JSON.parse(attacksContents)
            : {}

        const report = [
            '===================',
            `|| Hacking Stats ||`,
            '===================',
            '',
        ]

        for (const stat of Object.values(stats).sort((a, b) => b.average - a.average).splice(0, 20)) {

            const server = await this.nsProxy['getServer'](stat.target)
            // get some more info about the servers
            const skillMult = (1.75 * this.player.hacking) + (0.2 * this.player.intelligence)
            const skillChance = 1 - (server.requiredHackingSkill / skillMult)
            const difficultyMult = (100 - server.minDifficulty) / 100
            const successChance = Math.min(1, skillChance * difficultyMult * this.player.hacking_chance_mult)
            const hackValue = server.moneyMax * successChance * settings.hackPercent
            const hostAttacks = attacks.filter(a => a.target === stat.target)
            const hostHackAttacks = hostAttacks.filter(a => a.action === 'hack' || a.action === 'force')
            const hostPrepAttacks = hostAttacks.filter(a => a.action !== 'hack' && a.action !== 'force')

            const serverReport = [
                `${stat.target.padEnd(20, ' ')}`,
                `${this.ns.nFormat(stat.average, '$0.0a')} average VS ${this.ns.nFormat(hackValue, '$0.0a')} expected`,
                `${this.ns.nFormat(stat.total, '$0.0a')} / ${stat.attempts}`,
                `${this.ns.nFormat(stat.success / stat.attempts, '0%')} vs ${this.ns.nFormat(successChance, '0%')}`,
            ]
            if (hostHackAttacks.length) {
                const length = hostHackAttacks.length;
                const hostHackAttack = hostHackAttacks.pop()
                serverReport.push(`+${length} hacks, last one ends ${this.formatDelay(hostHackAttack.start + hostHackAttack.time - (new Date().getTime()))}`)
            }
            if (hostPrepAttacks.length) {
                const hostPrepAttack = hostPrepAttacks.pop()
                serverReport.push(`prep ends ${this.formatDelay(hostPrepAttack.start + hostPrepAttack.time - (new Date().getTime()))}`)
            }
            report.push(serverReport.join(' | '))
        }

        const hackAttacksList = attacks
        if (hackAttacksList.length) {
            const hostHackAttacks = {}
            for (const hostAttack of hackAttacksList) {
                if (!hostAttack.target) {
                    continue;
                }
                if (!hostHackAttacks[hostAttack.target]) {
                    hostHackAttacks[hostAttack.target] = []
                }
                hostHackAttacks[hostAttack.target].push(hostAttack)
            }
            report.push('')
            for (const [hostname, hostHackAttacksList] of Object.entries(hostHackAttacks)) {
                hostHackAttacksList.sort((a, b) => (a.start + a.time) - (b.start + b.time))
                report.push(`${hostname}: ${hostHackAttacksList.length} attacks ${hostHackAttacksList.map(a => a.action + '=' + this.formatDelay(a.start + a.time - (new Date().getTime()))).join(', ')}`)
            }
        }
        //
        // const prepAttacks = attacks.filter(a => a.action !== 'hack' && a.action !== 'force')
        // prepAttacks.sort((a, b) => (a.start + a.time) - (b.start + b.time))
        // if (prepAttacks.length) {
        //     report.push('')
        //     report.push(`${prepAttacks.length} prepping servers:`)
        //     report.push(` -> ${prepAttacks.map(a => a.target + ' ' + this.formatDelay(a.start + a.time - (new Date().getTime()))).join(', ')}`)
        // }

        this.ns.tprint("\n\n\n" + report.join("\n") + "\n\n\n")
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
     * Format a delay in MM:SS
     * Allows negative times (nsFormat didn't work)
     *
     * @param value time in milliseconds
     * @returns {string}
     */
    formatDelay(value) {
        value = value / 1000
        let hours = Math.floor(Math.abs(value) / 60 / 60),
            minutes = Math.floor((Math.abs(value) - (hours * 60 * 60)) / 60),
            seconds = Math.round(Math.abs(value) - (hours * 60 * 60) - (minutes * 60))
        return (value < 0 ? '-' : '')
            + (hours ? hours + ':' : '')
            + minutes
            + ':' + (seconds < 10 ? '0' + seconds : seconds)
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
            'Shows stats about hacking amounts.',
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
