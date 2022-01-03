/**
 * BaseComponent
 *
 * Base component class used to extend to other classes.
 */
export class BaseComponent {

    /**
     * @type {Application}
     */
    app = null;

    /**
     * Initialize the component
     *
     * @param {Application} app - The application instance created in your script's main entry point
     * @param {Object} options - key/value pairs used to set object properties
     */
    constructor(app, options = {}) {
        if (!app.ns.print) throw 'The first argument to Cache.constructor() must be an application with property "ns" being an instance of "ns".';
        this.app = app;

        // allow override of properties
        Object.entries(options).forEach(([key, value]) => this[key] = value);
    }

}