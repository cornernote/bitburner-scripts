/**
 * BaseComponent
 *
 * Base component class used to extend to other classes.
 */
export class BaseComponent {
    app = null;

    constructor(app, options = {}) {
        if (!app.ns.print) throw 'The first argument to Cache.constructor() must be an application with property "ns" being an instance of "ns".';
        this.app = app;

        // allow override of properties
        Object.entries(options).forEach(([key, value]) => this[key] = value);
    }
}