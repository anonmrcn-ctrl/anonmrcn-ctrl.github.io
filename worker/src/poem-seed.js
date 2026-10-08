let metricRow = 0;
let stanzaCount = 0;

function section(id, anchor, title, stanzas) {
    let linePosition = 0;

    return Object.freeze({
        id,
        anchor,
        position: ["I", "II", "III", "IV"].indexOf(anchor) + 1,
        title,
        lines: Object.freeze(stanzas.flatMap(
            ([paragraphClass, lines], stanzaIndex) => {
                if (stanzaCount > 0) {
                    metricRow += 1;
                }
                stanzaCount += 1;

                return lines.map(([text, indent]) => {
                    linePosition += 1;
                    metricRow += 1;

                    return Object.freeze({
                        id:
                            "poem-gajo-" + anchor.toLowerCase() + "-" +
                            String(linePosition).padStart(3, "0"),
                        position: linePosition,
                        text,
                        indent,
                        metadata: Object.freeze({
                            stanza: stanzaIndex + 1,
                            paragraphClass,
                            metricRow
                        })
                    });
                });
            }
        ))
    });
}

export const POEM_SEED = Object.freeze({
    id: "poem-il-gajo-tra-i-praelli",
    slug: "il-gajo-tra-i-praelli",
    title: "Il Gajo tra i Praelli",
    subtitle: "",
    sections: Object.freeze([
        section(
            "poem-gajo-canto-i",
            "I",
            "I",
            [
            ["", [
                ["E poi si svegliò", 0],
                ["il Gajo tra i Praelli", 1]
            ]],
            ["", [
                ["Si guardo da dentro", 0],
                ["e loro si salutarono", 1],
                ["Si guardò da fuori", 0],
                ["e si salutarono anche loro", 1]
            ]],
            ["", [
                ["Poi molte lune", 0],
                ["molti Risvegli", 1],
                ["molti Sguardi", 1],
                ["e", 1],
                ["molti Saluti", 1]
            ]],
            ["", [
                ["La vita non è altro", 0],
                ["che un cerchio", 1]
            ]],
            ["", [
                ["E poi si svegliò", 0],
                ["tra il Gajo e i Praelli", 1]
            ]],
            ["", [
                ["Si guardò dall’interno", 0],
                ["…", 1],
                ["Si guardò dall’esterno", 0],
                ["…", 1]
            ]],
            ["", [
                ["Poi sentì una fitta allo stomaco", 0],
                ["all’altezza di via Alta", 1],
                ["e le Ombre?", 2]
            ]],
            ["", [
                ["Poi sentì il suo sangue scorrere", 0],
                ["via Fornace, via Bosco Berizzi", 1],
                ["e il grigio Fiume?", 2]
            ]],
            ["", [
                ["La vita?", 0],
                ["Il cerchio?", 1]
            ]],
            ["", [
                ["E poi si diede un pizzicotto", 0]
            ]],
            ["", [
                ["Si chiese se per caso", 0],
                ["non stesse sognando", 1]
            ]]
            ]
        ),
        section(
            "poem-gajo-canto-ii",
            "II",
            "II",
            [
            ["isolato", [
                ["Ma", 0]
            ]],
            ["", [
                ["Forse in un futurista furore", 0],
                ["prese a idolatrare", 1],
                ["fra il Colmello e il Pojanon", 2]
            ]],
            ["", [
                ["E prese a tormentarsi", 0]
            ]],
            ["", [
                ["“Io devo perlustrare”", 0],
                ["Si disse", 1],
                ["“Ora devo osservare”", 0],
                ["Si ripeté", 1],
                ["“Ora io devo…”", 0],
                ["Si fermò", 1]
            ]],
            ["", [
                ["È infatti lì che notò", 0],
                ["qualcuno", 1],
                ["molto meno grande", 2],
                ["ma nella Sua stessa situazione", 3]
            ]],
            ["", [
                ["“Zero!”", 0],
                ["chiamò", 1],
                ["“Così non sono chiamato”", 0],
                ["“    ”", 1],
                ["“Vengo dalle Ombre”", 0],
                ["“chi ti fece”", 1],
                ["“Il grigio e veloce Fiume”", 0]
            ]],
            ["", [
                ["E riprese a idolatrare", 0]
            ]],
            ["", [
                ["“Ora devo perlustrare”", 0],
                ["Si disse", 1],
                ["“Io devo osservare”", 0],
                ["Si ripeté", 1],
                ["“Io ora devo…”", 0],
                ["“    ”", 1]
            ]],
            ["", [
                ["“perché?”", 0]
            ]],
            ["", [
                ["Perché?", 0]
            ]]
            ]
        ),
        section(
            "poem-gajo-canto-iii",
            "III",
            "III",
            [
            ["", [
                ["A quel punto successe", 0]
            ]],
            ["", [
                ["Qualcosa parlò", 0],
                ["e qualcosa successe", 1]
            ]],
            ["", [
                ["“Perché sei indietro”", 0],
                ["Si stupì, si sentì le ginocchia cadere", 1],
                ["“Perché sei goffamente indietro”", 0],
                ["Si girò, l’adrenalina salì", 1]
            ]],
            ["", [
                ["“Non hanno bisogno di te", 0],
                ["se non come gnomone", 1],
                ["come orma per la loro zampa", 2],
                ["come scheletro del tuo corpo”", 3]
            ]],
            ["isolato", [
                ["Ma", 0]
            ]],
            ["", [
                ["Si chiese", 0],
                ["nonostante tutto", 1]
            ]],
            ["perche", [
                ["Perché", 0]
            ]],
            ["", [
                ["Figura", 0],
                ["aprì la mano", 1],
                ["e gliela rivolse", 2]
            ]],
            ["", [
                ["Non ci vide più", 0]
            ]],
            ["", [
                ["“Ecco Il Perché”", 0],
                ["Disse", 1]
            ]],
            ["", [
                ["“Sei indietro, perché”", 0],
                ["Si girò, l’adrenalina saliva", 1],
                ["“Perché sei goffamente indietro”", 0],
                ["Si stupì, si sentì le ginocchia cedere", 1],
                ["come le fossero comparse dal nulla", 2],
                ["via della Costituzione", 3]
            ]],
            ["isolato", [
                ["Corse.", 0]
            ]]
            ]
        ),
        section(
            "poem-gajo-canto-iv",
            "IV",
            "IV",
            [
            ["", [
                ["Ora la futurista idolatria", 0],
                ["era in pieno controllo", 1]
            ]],
            ["figura", [
                ["Figura, l’Idolo,", 0],
                ["il Simulacro", 1]
            ]],
            ["", [
                ["E continuò", 0]
            ]],
            ["accelerazione", [
                ["rotolò, incespicò, cadde,", 0],
                ["Il Gajo, i Praelli", 1],
                ["si rialzò, corse,", 0],
                ["Inutili", 1],
                ["accelerando,", 0],
                ["Davanti al Bagliore", 1],
                ["senza scrupoli, letale,", 0]
            ]],
            ["accelerazione", [
                ["Zero, Fossa Storta", 1],
                ["incespicò, cadde, rotolò", 0],
                ["A57, A27, A4", 1],
                ["corse, si rialzò", 0],
                ["Non c’è Tempo", 1]
            ]],
            ["accelerazione", [
                ["accelerando", 0],
                ["la Calma è da vecchi", 1],
                ["letale, senza scrupoli", 0]
            ]],
            ["parole", [
                ["Il Bagliore", 0],
                ["L’Accelerazione", 0],
                ["L’Accecamento", 0],
                ["L’Ebrezza", 0]
            ]],
            ["non-tempo", [
                ["Non c’è tempo", 0]
            ]],
            ["figura", [
                ["Figura, l’Idolo,", 0],
                ["il Simulacro", 1]
            ]],
            ["", [
                ["E", 0],
                ["preso dal Bagliore", 1],
                ["reincontrò", 2]
            ]],
            ["chi", [
                ["Chi?", 0]
            ]],
            ["finale", [
                ["“Dove corri?”", 0]
            ]]
            ]
        )
    ])
});
