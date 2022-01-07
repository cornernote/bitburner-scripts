/**
 * Settings
 * @type {Object}
 */
export const settings = {

    // reserved memory on home
    // used to run the daemon and background runners
    reservedHomeRam: 1.6 + 10, // 1.6 for a background script, plus the max ram function used

    // the prefix given to purchased servers
    purchasedServerPrefix: 'homenet-',

    // used to calculate hack value
    // hackValue = server.moneyMax * (settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel))
    minSecurityWeight: 100,

    // used to decide if hack action=weaken
    // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
    minSecurityLevelOffset: 1,

    // used to decide if hack action=grow
    // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
    maxMoneyMultiplayer: 0.9,

    // how often to run rootServers()
    rootServersInterval: 60 * 5 * 1000, // 5mins
}
