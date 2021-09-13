const fetch = require('node-fetch');
const cheerio = require('cheerio');
const logError = require('./log_error');

class StudisClient {

    /**
     * The object containing all of the parsed data.
     * @type {{racuni: [], predmetnik: [], prosnje: [], sklepi: [], roki: [], posodobljeno: string}}
     */
    #data = {
        roki: [],
        predmetnik: [],
        sklepi: [],
        prosnje: [],
        racuni: [],
        posodobljeno: ""
    };

    #counter = 10;
    #nextRefresh = null;
    fastRefresh = 60000;
    slowRefresh = 60000 * 60;
    reLogPeriod = 24 * 60 * 60 * 1000;

    username = "";
    #password = "";

    #cookies = "";
    #cookieTime;

    /**
     * The constructor function. Sets the basic options.
     * @param {Object} options - The client options.
     * @param {number|undefined} options.fastRefresh - How many seconds between fast refreshes.
     * @param {number|undefined} options.slowRefresh - How many seconds between slow refreshes.
     * @param {number|undefined} options.reLogPeriod - How many seconds between login refreshes.
     */
    constructor(options = {}) {
        if (options.fastRefresh) this.fastRefresh = options.fastRefresh * 1000;
        if (options.slowRefresh) this.slowRefresh = options.slowRefresh * 1000;
        if (options.reLogPeriod) this.reLogPeriod = options.reLogPeriod * 1000;

        this.#cookieTime = new Date();
    }

    /**
     * Updates the data if necessary and returns a promise containing JSON data.
     * @returns {Promise<string | void>|Promise<string>} The JSON data.
     */
    getData() {
        if (this.#counter === 0) {
            clearTimeout(this.#nextRefresh);
            this.#counter = 10;
            this.#nextRefresh = setTimeout(() => {
                this.#loop();
            }, this.fastRefresh);
            return this.#refresh()
                .then(() => JSON.parse(JSON.stringify(this.#data)))
                .catch(logError);
        }
        return Promise.resolve(JSON.parse(JSON.stringify(this.#data)));
    }

    /**
     * Sets the client's username and password and begins the login process.
     * @param {string} username - The username (UL Identity)
     * @param {string} password - The password (UL Identity)
     */
    begin(username, password) {
        this.username = username;
        this.#password = password;
        this.#reLog();
    }

    /**
     * Fetches the login page and extracts the verification token.
     * Also sets the initial cookies.
     * @returns {Promise<string>} A promise containing __RequestVerificationToken.
     */
    #getLoginForm() {
        return fetch("https://studij.fe.uni-lj.si/Account/Login", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "en-SI,en-US;q=0.9,en;q=0.8",
                "cache-control": "max-age=0",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": ""
            },
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        }).then(res => {
            this.#cookies = StudisClient.#parseCookies(res);
            return res;
        })
            .then(res => res.text())
            .then(body => cheerio.load(body))
            .then(html => html('input[name="__RequestVerificationToken"]')[0])
            .then(input => input.attribs.value)
    }

    /**
     * Takes the fetch() response and parses the cookies which need to be set.
     * @param response The fetch() response.
     * @returns {string} The cookies to be used in future requests.
     */
    static #parseCookies(response) {
        const raw = response.headers.raw()['set-cookie'];
        return raw.map(entry => {
            const parts = entry.split(';');
            return parts[0];
        }).join(';');
    }

    /**
     * Performs a login using the token, username and password.
     * Returns the session cookies.
     * @param {string} token __RequestVerificationToken
     * @returns {Promise<string>} The session cookies.
     */
    #login(token) {
        return fetch("https://studij.fe.uni-lj.si/Account/Login", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "en-SI,en-US;q=0.9,en;q=0.8",
                "cache-control": "max-age=0",
                "content-type": "application/x-www-form-urlencoded",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": this.#cookies
            },
            "referrer": "https://studij.fe.uni-lj.si/",
            "referrerPolicy": "strict-origin",
            "body": `__RequestVerificationToken=${token}` +
                `&Username=${encodeURIComponent(this.username)}` +
                `&Password=${encodeURIComponent(this.#password)}`,
            "method": "POST",
            "mode": "cors",
            "redirect": "manual"
        })
            .then(res => StudisClient.#parseCookies(res))
            .then(loginCookies => this.#cookies = `${this.#cookies}; ${loginCookies}`);
    }

    /**
     * Fetches the dashboard, and calls all of the parser functions.
     * @returns {Promise<*>} A promise that resolves
     * when all parser functions resolve.
     */
    #refresh() {
        let body = fetch("https://studij.fe.uni-lj.si/DashboardStudent", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "en-SI,en-US;q=0.9,en;q=0.8",
                "cache-control": "max-age=0",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": this.#cookies
            },
            "referrerPolicy": "strict-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        }).then(res => res.text()).then(body => cheerio.load(body));

        return Promise.all([
            body.then(html => this.#parsePredmetnik(html))
        ]).then(() => this.#data.posodobljeno = (new Date()).toISOString())
            .catch(logError);
    }

    /**
     * Parses all of the subjects and populates the data.predmetnik array.
     * @param {cheerio.CheerioAPI} html The Cheerio object of the page.
     * @returns {Promise<*[]>} A promise that resolves
     * when data.predmetnik is populated.
     */
    #parsePredmetnik(html) {
        let predmeti = [];
        html('h3:contains("Moj predmetnik")').siblings('.row-striped').children('.row')
            .each((i, el) => {
                predmeti.push(this.#getDataFromRow(html, el));
            });
        return this.#getStatistics(predmeti).then(() => this.#data.predmetnik = predmeti);
    }

    /**
     * Creates an object representing the grades for a subject.
     * @param {cheerio.CheerioAPI} html
     * @param {Element} row
     * @returns {{}}
     */
    #getDataFromRow(html, row) {
        let predmet = {};
        predmet.ime = html(row).find('span[data-toggle=tooltip]').first().text().trim();
        let micros = html(row).find('.skip-micro');
        predmet.sprotne = micros.eq(1).children().first().text().trim();
        predmet.kolokviji = {skupaj: "", posamezno: []};
        predmet.kolokviji.skupaj = micros.eq(2).children('span[title^="U"]').first().text().trim();
        micros.eq(2).children('span[title^="Š"]').each((index, el) => {
            predmet.kolokviji.posamezno.push(html(el).text());
        })
        predmet.izpit = micros.eq(3).children().first().text().trim();
        predmet.ocena = micros.eq(4).children().first().children().first().text().trim();
        predmet.statistika = "";
        predmet.url = micros.eq(4).children().first().children('a').attr('data-modal-url');
        return predmet;
    }

    /**
     * Fetches the statistics for each subject, if available.
     * @param predmeti
     * @returns {Promise<unknown[]>}
     */
    #getStatistics(predmeti) {
        let promises = [];

        for (let predmet of predmeti) {
            if (!predmet.url) {
                delete predmet.url;
                continue;
            }
            let promise = fetch(predmet.url, {
                "headers": {
                    "accept": "text/html, */*; q=0.01",
                    "accept-language": "en-SI,en-US;q=0.9,en;q=0.8",
                    "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest",
                    "cookie": this.#cookies
                },
                "referrer": "https://studij.fe.uni-lj.si/",
                "referrerPolicy": "strict-origin",
                "body": null,
                "method": "GET",
                "mode": "cors"
            })
                .then(res => res.text())
                .then(body => body.match(/(?<=data: \[)(.*?)(?=],)/s)[0].split(","))
                .then(ocene => {
                        delete predmet.url;
                        if (ocene.length !== 5) {
                            predmet.statistika = "";
                        } else {
                            predmet.statistika = {};
                            predmet.statistika["6"] = parseInt(ocene[0]);
                            predmet.statistika["7"] = parseInt(ocene[1]);
                            predmet.statistika["8"] = parseInt(ocene[2]);
                            predmet.statistika["9"] = parseInt(ocene[3]);
                            predmet.statistika["10"] = parseInt(ocene[4]);
                            predmet.statistika.skupaj = ocene.reduce((a, b) => parseInt(a) + parseInt(b), 0);
                        }
                    }
                );
            promises.push(promise);
        }

        return Promise.all(promises);
    }

    #reLog() {
        this.#getLoginForm()
            .then(token => this.#login(token))
            .then(() => this.#loop())
            .catch(err => {
                logError(err);
                console.log("Error while logging in, try again in 60 seconds.")
                setTimeout(() => this.#reLog(), 60000);
            });
    }

    #loop() {
        let time = new Date();
        // Re-login every 24 hours
        if (time - this.#cookieTime > this.reLogPeriod) {
            this.#cookieTime = time;
            this.#reLog();
        } else {
            this.#refresh().catch(logError);
            let timeout = this.slowRefresh;
            if (this.#counter > 0) {
                this.#counter--;
                timeout = this.fastRefresh;
            }
            this.#nextRefresh = setTimeout(() => {
                this.#loop();
            }, timeout);

        }
    }
}

module.exports = StudisClient;