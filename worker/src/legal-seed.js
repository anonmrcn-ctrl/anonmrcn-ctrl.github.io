const PRIVACY_BODY_HTML = `
<section>
    <h2>1. Titolare e contatti</h2>
    <p>
        Il titolare del trattamento è l’autore e amministratore di
        <strong>anonMrcn</strong>, progetto artistico indipendente e senza
        scopo di lucro, sostenuto tramite libere donazioni su Produzioni
        dal Basso. Per richieste sulla privacy, accesso ai dati o
        cancellazione puoi scrivere a
        <a href="mailto:anonmrcn@gmail.com">anonmrcn@gmail.com</a>.
    </p>
</section>

<section>
    <h2>2. Dati trattati e finalità</h2>
    <p>
        Quando richiedi un token possono essere trattati username, email,
        via o zona generica e un punto geografico. Servono esclusivamente
        a valutare la richiesta, inviare il token, creare la location
        approssimativa e permettere la partecipazione al progetto.
    </p>
    <p>
        L’indirizzo deve essere inserito senza numero civico. Se selezioni
        un punto sulla mappa, prima del salvataggio il sistema lo sposta
        automaticamente di circa 250–400 metri: le coordinate esatte non
        vengono conservate. Un codice pseudonimo derivato dall’indirizzo IP
        è usato soltanto per limitare gli abusi del modulo.
    </p>
</section>

<section>
    <h2>3. Base giuridica e consenso</h2>
    <p>
        Il trattamento necessario a ricevere il token e partecipare al
        progetto si fonda sul consenso espresso tramite la casella non
        preselezionata del modulo. La prevenzione di invii abusivi e la
        sicurezza del servizio si fondano sul legittimo interesse alla
        protezione del sito. Il consenso può essere revocato in qualsiasi
        momento, senza pregiudicare i trattamenti già effettuati.
    </p>
</section>

<section>
    <h2>4. Visibilità della posizione</h2>
    <p>
        La location nasce nascosta. Soltanto dopo una tua scelta esplicita
        può essere mostrata agli altri membri autenticati tramite token.
        Sulla mappa compaiono esclusivamente una via o zona generica e un
        segnalino approssimativo, non il numero civico, l’indirizzo esatto,
        l’email o lo username. Puoi nascondere nuovamente il punto in
        qualsiasi momento dal menu del sito.
    </p>
</section>

<section>
    <h2>5. Conservazione</h2>
    <p>
        Le richieste inviate tramite i moduli, comprese email e indicazioni
        di zona, vengono cancellate automaticamente entro 30 giorni. I dati
        dell’account e la location già resa approssimativa sono conservati
        fino alla richiesta di cancellazione o alla conclusione del
        progetto. La sessione del token può durare fino a un anno ed è
        revocabile effettuando la disconnessione.
    </p>
</section>

<section>
    <h2>6. Destinatari e servizi tecnici</h2>
    <p>
        I dati non sono venduti. Possono essere trattati, nei limiti
        necessari al funzionamento, dai servizi tecnici che ospitano il
        sito e il database, tra cui GitHub Pages e Cloudflare. Le pagine
        pubbliche usano GoatCounter per statistiche di visita; i parametri
        degli indirizzi web, compresi eventuali token, non vengono inviati
        al contatore.
    </p>
</section>

<section>
    <h2>7. Diritti dell’interessato</h2>
    <p>
        Puoi chiedere accesso, rettifica, cancellazione, limitazione,
        portabilità e opposizione al trattamento, quando applicabili,
        scrivendo all’indirizzo indicato sopra. Puoi inoltre proporre
        reclamo al Garante per la protezione dei dati personali. Non sono
        adottate decisioni automatizzate o attività di profilazione.
    </p>
</section>

<section>
    <h2>8. Richiesta di rimozione</h2>
    <p>
        Puoi richiedere in qualsiasi momento la rimozione del tuo punto,
        del token e dei dati collegati scrivendo a
        <a href="mailto:anonmrcn@gmail.com">anonmrcn@gmail.com</a>.
    </p>
</section>
`.trim();

const PRIVACY_BODY_HTML_V2 = `
<section>
    <h2>1. Titolare e contatti</h2>
    <p>
        Il titolare del trattamento è l’autore e amministratore di
        <strong>anonMrcn</strong>, progetto artistico indipendente e senza
        scopo di lucro. Per richieste sulla privacy puoi scrivere a
        <a href="mailto:anonmrcn@gmail.com">anonmrcn@gmail.com</a>.
    </p>
</section>

<section>
    <h2>2. Dati trattati e finalità</h2>
    <p>
        Per l’accesso e la partecipazione possono essere trattati username,
        email, via o zona generica, posizione approssimata, poesia, messaggi,
        preferenze di visibilità e dati tecnici delle notifiche richieste dal
        dispositivo. Password e token non sono conservati in chiaro.
    </p>
    <p>
        Non viene richiesto il numero civico. Le coordinate vengono spostate
        automaticamente di circa 250–400 metri prima del salvataggio. Un
        codice pseudonimo derivato dall’indirizzo IP viene usato soltanto per
        limitare gli abusi e non per identificare o profilare la persona.
    </p>
</section>

<section>
    <h2>3. Consenso e visibilità</h2>
    <p>
        La location nasce nascosta e diventa visibile agli altri partecipanti
        soltanto dopo una scelta esplicita, revocabile in ogni momento. I
        messaggi possono entrare nell’archivio pubblico solo con il consenso
        di mittente e destinatario e dopo moderazione.
    </p>
    <p>
        Le statistiche aggregate delle pagine pubbliche sono disattivate per
        impostazione predefinita. Dopo il consenso, GoatCounter riceve soltanto
        il percorso della pagina, senza query, frammento, referrer, titolo o
        eventi di clic. Le aree di accesso, amministrazione, spazio personale
        e taccuino non caricano telemetria.
    </p>
</section>

<section>
    <h2>4. Conservazione e minimizzazione</h2>
    <p>
        Le richieste di contatto e accesso vengono eliminate entro 30 giorni;
        i codici pseudonimi antiabuso delle Memorie vengono svuotati dopo 24
        ore. Le sessioni scadute vengono eliminate automaticamente. Account,
        poesia e messaggi restano fino alla cancellazione dell’account o alla
        conclusione del progetto, salvo obblighi di legge.
    </p>
</section>

<section>
    <h2>5. Servizi tecnici</h2>
    <p>
        I dati non sono venduti. GitHub Pages pubblica il sito; Cloudflare
        gestisce Worker, database D1, file R2 e protezione del servizio. Le
        mappe richieste dall’utente caricano tasselli Esri, che ricevono area e
        livello di zoom necessari a fornire la cartografia. GoatCounter e
        l’eventuale misurazione aggregata Cloudflare vengono attivati soltanto
        dopo consenso. Google Search Console è usato senza codice di
        tracciamento sul sito e solo per dati organici aggregati.
    </p>
</section>

<section>
    <h2>6. Esportazione e cancellazione</h2>
    <p>
        Dallo Spazio personale puoi scaricare una copia dei dati della tua
        location ed eliminare direttamente account, poesia, messaggi,
        sessioni e notifiche. L’esportazione non contiene password, token,
        chiavi tecniche o dati identificativi delle altre location.
    </p>
    <p>
        Dopo la cancellazione resta soltanto un record anonimo con
        l’identificativo numerico storico, senza credenziali, coordinate o
        contenuti. Serve esclusivamente a impedire che QR, collegamenti e ID
        precedenti vengano assegnati a un’altra persona. Il taccuino è salvato
        soltanto sul dispositivo e non viene ricevuto dal servizio.
    </p>
</section>

<section>
    <h2>7. Diritti dell’interessato</h2>
    <p>
        Puoi esercitare accesso e cancellazione dallo Spazio personale. Per
        rettifica, limitazione, portabilità, opposizione o assistenza puoi
        scrivere al contatto indicato sopra. Puoi inoltre proporre reclamo al
        Garante per la protezione dei dati personali.
    </p>
</section>

<section>
    <h2>8. Decisioni automatizzate</h2>
    <p>
        Non vengono adottate decisioni automatizzate né svolte attività di
        profilazione o pubblicità comportamentale.
    </p>
</section>
`.trim();

export const PRIVACY_DOCUMENT_SEED = Object.freeze({
    id: "privacy",
    slug: "privacy",
    title: "Informativa sulla Privacy",
    version: Object.freeze({
        id: "privacy-2026-10-03",
        number: 1,
        effectiveDate: "2026-10-03",
        bodyHtml: PRIVACY_BODY_HTML,
        checksum: "0348a9efdb4d2cff7f9e973771941529b120ccf15cda8741a8307ea1960a5d79"
    })
});

export const PRIVACY_DOCUMENT_V2_SEED = Object.freeze({
    id: "privacy",
    slug: "privacy",
    title: "Informativa sulla Privacy",
    version: Object.freeze({
        id: "privacy-2026-10-12",
        number: 2,
        effectiveDate: "2026-10-12",
        bodyHtml: PRIVACY_BODY_HTML_V2,
        checksum: "1261b608808db3606d22c482547357d599979684be7d642ae906730d52a302d4"
    })
});
