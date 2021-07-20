const fetch = require('node-fetch');
const cheerio = require('cheerio');

const express = require('express');
const app = express();
const http = require('http').createServer(app);

const secrets = require('./secrets.json');

http.listen(3604);

let predmeti = []

app.get('/', ((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(predmeti));
}));

getLoginForm()
    .then(res => login(res))
    .then(cookies => loop(cookies))
    .catch(err => console.error(err));

async function getLoginForm() {
    let res = await fetch("https://studij.fe.uni-lj.si/Account/Login", {
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
    let html = cheerio.load(await res.text());
    let input = html('input[name="__RequestVerificationToken"]')[0];
    let token = input.attribs.value;
    let loginCookies = parseCookies(res);

    return {token: token, cookies: loginCookies};
}

function parseCookies(response) {
    const raw = response.headers.raw()['set-cookie'];
    return raw.map((entry) => {
        const parts = entry.split(';');
        return parts[0];
    }).join(';');
}

async function login(params) {
    let res = await fetch("https://studij.fe.uni-lj.si/Account/Login", {
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
    });
    let loginCookies = parseCookies(res);
    return `${params.cookies}; ${loginCookies}`;
}

function refresh(cookies) {
    fetch("https://studij.fe.uni-lj.si/DashboardStudent", {
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
        .then(html => html('.row-striped').eq(0).html())
        .then(body => cheerio.load(body))
        .then(table => table('.row').each((i, el) => {
            predmeti.push(getDataFromRow(table(el).html()));
        }))
        .catch(err => console.error(err));
}

function getDataFromRow(row) {
    let predmet = {};
    let body = cheerio.load(row);
    predmet.name = body('span[data-toggle=tooltip]').first().text().trim();
    let micros = body('.skip-micro');
    predmet.sprotne = micros.eq(1).children().first().text().trim();
    predmet.kolokviji = micros.eq(2).children().first().text().trim();
    predmet.izpit = micros.eq(3).children().first().text().trim();
    predmet.ocena = micros.eq(4).children().first().children().first().text().trim();
    return predmet;
}


function loop(cookies) {
    refresh(cookies);
    setTimeout(() => {loop(cookies)},60000);
}
