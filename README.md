# FE Studis API

Enostavna Node.js *web scraper* aplikacija, ki izvede prijavo v sistem Studis 
in izlušči podatke o predmetih ter pripadajočih ocenah.

## Namestitev

1. Repozitorij prenesite ali kloniranjte, nato pa v mapi poženite ukaz `npm i`, 
   da namestite zahtevane module.

2. V mapi ustvarite datoteko `secrets.json` z vsebino:
```json
{
  "Username": "<vaš univerzitetni email naslov>",
  "Password": "<vaše geslo>"
}
```

3. Zaženite `node index.js`

## Uporaba API-ja

Aplikacija na vratih 3604 postavi strežnik, ki ob klicu GET vrne nazadnje 
prebrane podatke v formatu JSON. Skripta podatke osvežuje enkrat na minuto,
enkrat na dan pa se ponovno prijavi v Studis, da osveži piškotke. 
Rezultat je JSON Object, ki vsebuje Arraye, ki ustrezajo posameznim 
kategorijam v Studisu.

```json
{
  "roki": [],
  "predmetnik": [],
  "sklepi": [],
  "prosnje": [],
  "racuni": [],
  "posodobljeno": "čas zadnje uspešne posodobitve v formatu ISO 8601"
}
```

### Roki

_TBA_

### Predmetnik `predmetnik [{}]`

```json
{
  "ime": "ime in šifra predmeta",
  "sprotne": "točke sprotnih obveznosti",
  "kolokviji": {
    "skupaj": "utežena vsota točk kolokvijev",
    "posamezno": ["niz točk posameznih kolokvijev"]
  },
  "izpit": "točke pisnega izpita",
  "ocena": "končna ocena predmeta",
  "statistika": {
    "6": "število ocen 6",
    "...":  "...",
    "10": "število ocen 10",
    "skupaj": "skupno število ocen"
  }
}
```

### Sklepi

_TBA_

### Prošnje

_TBA_

### Računi `racuni [{}]`

```json
{
  "stevilka": "številka računa",
  "znesek": "znesek računa",
  "za_placilo": "znesek, ki ga je treba plačati",
  "datum_zapadlosti": "datum zapadlosti",
  "namen": "namen",
  "sklic": "sklic",
  "trr": "TRR fakultete"
}
```

## FAQ

* **Je to varno? (Mi boš ukradel geslo, če uporabim ta program?)**

    Pinky promise, da ne bom (poglej kodo, saj ni tak komplicirana).
  
* **Je to dovoljeno?**

    Well idk, Studis nikjer nima napisanih kakih splošnih pogojev, ki bi to 
    prepovedovali, dostopaš samo do svojih ocen, edina stvar, ki bi lahko bila 
    sporna je, da se zgodi zahteva vsako minuto, če bi vsi uporabljali to 
    aplikacijo, bi to pomenilo veliko avtomatskih zahtev, ampak honestly, če 
    server tega ne prenese, je kinda žalostno.
  
* **Zakaj je koda grda / nekomentirana / neučinkovita**

    Ker sem štromar ne pa FRI-jevec in ker iskreno povedano 
    še vedno nimam pojma, kako deluje jQuery.
