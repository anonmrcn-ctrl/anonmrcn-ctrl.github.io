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
