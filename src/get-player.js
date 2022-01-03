import {App} from "./includes/Application";

/** @param {NS} ns **/
export async function main(ns) {
    let app = new Application;
    app.init(ns);
    app.logger.log('Starting get-player.js', true);
    app.cache.setItem('player', ns.getPlayer(), 10)
    app.logger.log('Player data has been saved!', true);
}

