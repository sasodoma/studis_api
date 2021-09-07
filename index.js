const fetch = require('node-fetch');
const cheerio = require('cheerio');

const express = require('express');
const app = express();
const http = require('http').createServer(app);

const secrets = require('./secrets.json');

http.listen(3604);

let predmeti = []

let counter = 10;
let nextRefresh = null;

app.get('/', ((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (counter === 0) {
        clearTimeout(nextRefresh);
        counter = 10;
        refresh().then(() => {
            res.send(JSON.stringify(predmeti));

        }).catch(console.error);
    }
    res.send(JSON.stringify(predmeti));
}));

function getLoginForm() {
    let promise = fetch("https://studij.fe.uni-lj.si/Account/Login", {
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
    });
    return Promise.all([
        promise.then(res => res.text())
            .then(body => cheerio.load(body))
            .then(html => html('input[name="__RequestVerificationToken"]')[0])
            .then(input => ({token: input.attribs.value})),
        promise.then(res => ({cookies: parseCookies(res)}))
    ]).then(res => Object.assign({}, ...res))
}

function parseCookies(response) {
    const raw = response.headers.raw()['set-cookie'];
    return raw.map((entry) => {
        const parts = entry.split(';');
        return parts[0];
    }).join(';');
}

function login(params) {
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
            "cookie": params.cookies
        },
        "referrer": "https://studij.fe.uni-lj.si/",
        "referrerPolicy": "strict-origin",
        "body": `__RequestVerificationToken=${params.token}` +
                `&Username=${encodeURIComponent(secrets.Username)}` +
                `&Password=${encodeURIComponent(secrets.Password)}`,
        "method": "POST",
        "mode": "cors",
        "redirect": "manual"
    })
        .then(res => parseCookies(res))
        .then(loginCookies => `${params.cookies}; ${loginCookies}`);
}

function refresh(cookies) {
    return fetch("https://studij.fe.uni-lj.si/DashboardStudent", {
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
            "cookie": cookies
        },
        "referrerPolicy": "strict-origin",
        "body": null,
        "method": "GET",
        "mode": "cors"
    })
        .then(res => res.text())
        .then(body => cheerio.load(body))
        .then(html => {
            predmeti = [];
            html('h3:contains("Moj predmetnik")').siblings('.row-striped').children('.row').each((i, el) => {
                predmeti.push(getDataFromRow(html, el));
            });
            return predmeti;
        })
        .then(predmeti => getStatistics(predmeti, cookies))
        .catch(err => {
            console.error(err);
            reLog();
            predmeti = [];
        });
}

function getStatistics(predmeti, cookies) {
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
                "cookie": cookies
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
                        predmet.statistika.skupno = ocene.reduce((a, b) => parseInt(a) + parseInt(b), 0);
                    }
                }
            );
        promises.push(promise);
    }

    return Promise.all(promises);
}

/**
 * Creates an object representing the grades for a subject.
 * @param {cheerio.CheerioAPI} html
 * @param {Element} row
 * @returns {{}}
 */
function getDataFromRow(html, row) {
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

function reLog() {
    getLoginForm()
        .then(res => login(res))
        .then(cookies => loop(cookies))
        .catch(err => {
            console.error(err);
            console.log("Error while logging in, try again in 60 seconds.")
            setTimeout(reLog, 60000);
        });
}

let cookieTime = new Date();

function loop(cookies) {
    let time = new Date();
    // Re-login every 24 hours
    if (time - cookieTime > 24 * 60 * 60 * 1000) {
        cookieTime = time;
        reLog();
    } else {
        refresh(cookies).catch(console.error);
        let timeout = 60000 * 60;
        if (counter > 0) {
            counter--;
            timeout = 60000;
        }
        nextRefresh = setTimeout(() => {
            loop(cookies)
        }, timeout);

    }
}

reLog();
