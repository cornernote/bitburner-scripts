/**
 * Settings
 * @type {Object}
 */
export const settings = {

    // reserved memory on home
    // used to run the worker and background runners
    reservedHomeRam: 1.6 + 10, // 1.6 for a background script, plus the max ram function used

    // the prefix given to purchased servers
    purchasedServerPrefix: 'homenet',

    // used to calculate hack value
    // hackValue = server.moneyMax * (settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel))
    minSecurityWeight: 100,

    // used to decide if hack action=weaken
    // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
    minSecurityLevelOffset: 1,

    // used to decide if hack action=grow
    // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
    maxMoneyMultiplayer: 0.9,

    // how much to steal per hack
    hackPercent: 0.6, //60%

    // how often to run delay between scripts (in milliseconds)
    intervals: {
        'upgrade-hacknet': 1000, // 1s
        'host-manager': 60 * 1000, // 1mins
        'root-servers': 60 * 1000, // 1mins
        'attack-server': 10 * 1000, // 1mins
        'buy-cracks': 60 * 1000, // 1mins
    },

    // controls how far to upgrade hacknet servers
    hacknetMaxPayoffTime: 0,  // in seconds

    // controls how far to upgrade hacknet servers
    hacknetMaxSpend: 0,
}

