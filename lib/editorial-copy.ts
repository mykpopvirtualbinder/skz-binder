const LANGS = ["es", "en", "fr", "de", "it", "pt", "id", "th", "ja", "ko", "zh"] as const;
export type EditorialLang = (typeof LANGS)[number];

export function editorialLang(value: string | null | undefined): EditorialLang {
  const code = String(value || "es").toLowerCase().slice(0, 2);
  return (LANGS as readonly string[]).includes(code) ? (code as EditorialLang) : "es";
}

export type AboutCopy = {
  kicker: string;
  title: string;
  subtitle: string;
  greeting: string;
  welcome: string;
  whoTitle: string;
  who: [string, string];
  startTitle: string;
  start: [string, string, string, string, string];
  codeTitle: string;
  code: [string, string, string];
  visionTitle: string;
  vision: [string, string, string, string];
  close: string;
  love: string;
  team: string;
};

export type ArtistCopy = {
  headline: string;
  history: [string, string, string, string, string];
  fact: string;
  news: [string, string, string];
};

const about: Record<EditorialLang, AboutCopy> = {
  es: {
    kicker: "MY K-POP BINDER",
    title: "Sobre nosotras",
    subtitle: "La historia de MyKpopBinder",
    greeting: "MKBees, STAY (y el resto de fans y coleccionistas de K-pop), ¡annyeong!",
    welcome: "Estamos felices y emocionadas de daros por fin la bienvenida a MyKpopBinder. Esta plataforma la hemos creado fans, para fans, por puro amor, dedicación y una pasión compartida por el mundo del K-pop.",
    whoTitle: "Quiénes somos",
    who: [
      "Somos tres entusiastas del K-pop que vivimos en España y que conectamos de verdad con este universo hacia 2024, aunque una de nosotras ya había llegado al K-pop a través de BTS alrededor de 2015. Lo que empezó como admiración por la música se convirtió en una amistad fuerte, alrededor del amor que compartimos por Stray Kids.",
      "En el fondo somos STAYs, pero el gusto sigue creciendo: una de nosotras viene de ARMY, y juntas estamos cayendo en grupos tan increíbles como ATEEZ, Xdinary Heroes y muchos más.",
    ],
    startTitle: "Cómo empezó todo",
    start: [
      "En nuestros primeros pasos como baby STAYs en este mundo nuevo, nos topamos con un problema enorme: ¿por qué y cómo hay tantas cosas que coleccionar?",
      "Photocards de álbum, pre-order benefits (POBs), lucky draws, inclusiones de merch... ¡hasta descubrimos que las photocards pueden venir con protector solar!",
      "Eso llevó al problema número dos: pedir como locas, quererlo todo, entrar en más de 500 Group Orders (GOs) y acabar con duplicados, claims olvidados y ni idea de qué habíamos comprado ni de dónde venía (porque todas hemos estado ahí).",
      "Un día, comiendo juntas, se nos ocurrió: ¿y si creamos un espacio virtual donde llevar el control de álbumes, merch, photocards e inclusiones en un solo sitio?",
      "Ir por ahí con binders de 9 huecos a tiendas y eventos no es práctico, y los claims de GOM o los anuncios de trade siempre aparecen en el peor momento. Tener un sitio digital para mirar rápido si debes reclamar una PC o no puede salvarte la vida — o el dinero del próximo concierto, ¿quiénes somos nosotras para juzgar?",
    ],
    codeTitle: "El camino del código",
    code: [
      "Así nació MyKpopBinder. O, al menos, la idea. Después vinieron muchos meses de aprendizaje y de trabajo para convertir ese sueño en realidad.",
      "Ninguna de nosotras tiene formación profesional en informática, diseño web o programación. Tenemos nuestras vidas, trabajos y responsabilidades fuera de este proyecto. Pero pusimos el corazón en construir esta plataforma por puro amor (y necesidad) y por pasión. Lo aprendimos todo desde cero, reunimos todos los datos que pudimos y pasamos horas puliendo la experiencia.",
      "Aunque queda muchísimo por hacer, sentimos que ya era hora de abrir las puertas, invitaros a este camino y seguir creciendo juntas.",
    ],
    visionTitle: "Nuestra visión y la comunidad",
    vision: [
      "Para nosotras, ser STAY es formar parte de una familia cercana y de una comunidad que se apoya. Queremos llevar ese mismo sentimiento a MyKpopBinder.",
      "Queremos que esta plataforma sea un espacio seguro, acogedor e inclusivo, donde cada persona pueda expresarse, compartir el amor por sus grupos y ser quien quiera ser. El respeto mutuo y la aceptación son los pilares de este proyecto.",
      "Ahora la plataforma está centrada sobre todo en Stray Kids, pero, a medida que el equipo y la comunidad crezcan, el objetivo es sumar todos los grupos que podamos, con vuestra ayuda y vuestros comentarios.",
      "Únete a otros fans para coleccionar, llevar el control, tradear y explorar todo lo que ofrece el K-pop. Siéntete en casa y deja libre tu pasión en una comunidad sin juicios.",
    ],
    close: "MyKpopBinder — tu K-space seguro.",
    love: "Con todo nuestro amor,",
    team: "El equipo de MyKpopBinder: P.A.S.",
  },
  en: {
    kicker: "MY K-POP BINDER",
    title: "About Us",
    subtitle: "The Story Behind MyKpopBinder",
    greeting: "MKBees, STAY (and fellow K-Pop fans & collectors) annyeong!",
    welcome: "We are beyond happy and excited to finally welcome you to MyKpopBinder! This platform was created by fans, for fans, out of pure love, dedication, and a shared passion for the incredible world of K-Pop.",
    whoTitle: "Who We Are",
    who: [
      "We are three K-Pop enthusiasts based in Spain who developed a deep connection with this universe around 2024, although one of us had already been in contact with K-pop through BTS around 2015. What started as an admiration for the music quickly turned into a strong friendship centered around our shared love for Stray Kids.",
      "While we are mostly STAYs at heart, our music taste continues to grow—one of us has a strong background as an ARMY, and together we are rapidly falling into the traps of incredible groups like ATEEZ, Xdinary Heroes, and many more.",
    ],
    startTitle: "How It All Started",
    start: [
      "In the midst of our first steps as baby STAYs! into this new world, we quickly stumbled upon one giant problem: Why and how is there so much stuff to collect?!",
      "Album photocards, pre-order benefits (POBs), lucky draws, merch inclusions... we even found out photocards can come with sunscreen?!",
      "That led to problem number two: ordering like crazy, wanting to get everything, joining over 500 Group Orders (GOs), and ultimately ending up with duplicates, forgotten claims, and zero idea of what we had bought or where it was coming from (because we’ve all been there and we’ve all done that!).",
      "So one day, while having lunch together, an idea hit us: Why not create a virtual space where we can easily keep track of all our albums, merch, photocards, and inclusions in one place?",
      "Walking around carrying heavy 9-grid binders to K-pop shops and events isn't very practical, and GOM claims or trade announcements always seem to pop up at the absolute worst times. Having a digital space to quickly check if you should claim a PC or not can literally be a life saver — well, call it a life saver or call it money saved for your next K-Pop concert, who are we to judge?",
    ],
    codeTitle: "The Journey Behind the Code",
    code: [
      "Thus, MyKpopBinder was born! Or at least, the idea of it. What followed were many months of intense learning and hard work to turn that dream into reality.",
      "None of us has a professional background in computer science, web design, or programming. We all have our daily lives, jobs, and responsibilities beyond this project. But we poured our hearts and souls into building this platform out of pure love (necessity) and passion. We learned everything from scratch, gathered as much data as we could, and spent countless hours refining the experience.",
      "Although there is still so much to do and build, we felt it was finally time to open our doors, invite you into this journey, and continue growing together.",
    ],
    visionTitle: "Our Vision & Community",
    vision: [
      "For us, being a STAY means being part of a warm family and a supportive community. We want to extend that exact feeling to MyKpopBinder.",
      "We want this platform to be a safe, welcoming, and inclusive space where everyone feels free to express themselves, share their love for their favorite groups, and be exactly who they want to be. Mutual respect and acceptance are the core pillars of this project.",
      "Currently, the platform is mainly focused on Stray Kids, but as our team and community grow, our goal is to expand and add as many groups as possible with your help and feedback!",
      "Join us and other fans to collect, track, trade, and explore everything the K-Pop world has to offer. Feel right at home among friends, and give free reign to your passion in a judgment-free community.",
    ],
    close: "MyKpopBinder — your safe K-space.",
    love: "With all our love,",
    team: "The MyKpopBinder Team: P.A.S.",
  },
  fr: {
    kicker: "MY K-POP BINDER",
    title: "À propos",
    subtitle: "L’histoire de MyKpopBinder",
    greeting: "MKBees, STAY (et tous les fans et collectionneurs de K-pop), annyeong !",
    welcome: "Nous sommes heureuses et tellement impatientes de vous accueillir enfin sur MyKpopBinder. Cette plateforme a été créée par des fans, pour des fans, par amour, par dévouement et par passion pour le monde du K-pop.",
    whoTitle: "Qui nous sommes",
    who: [
      "Nous sommes trois passionnées de K-pop installées en Espagne, vraiment entrées dans cet univers vers 2024, même si l’une de nous connaissait déjà le K-pop grâce à BTS vers 2015. L’admiration pour la musique est vite devenue une amitié solide, autour de notre amour commun pour Stray Kids.",
      "Au fond, nous sommes des STAY, mais nos goûts continuent de s’élargir : l’une de nous vient d’ARMY, et ensemble nous tombons pour des groupes aussi incroyables qu’ATEEZ, Xdinary Heroes et bien d’autres.",
    ],
    startTitle: "Comment tout a commencé",
    start: [
      "Dans nos premiers pas de baby STAY, nous sommes tombées sur un énorme problème : pourquoi, et comment, y a-t-il autant de choses à collectionner ?",
      "Photocards d’album, pre-order benefits (POB), lucky draws, inclusions de merch... nous avons même découvert que les photocards peuvent arriver avec de la crème solaire !",
      "D’où le problème numéro deux : commander sans compter, tout vouloir, rejoindre plus de 500 group orders (GO) et se retrouver avec des doublons, des claims oubliés et aucune idée de ce que nous avions acheté ni d’où cela venait (parce que nous y sommes toutes passées).",
      "Un jour, en déjeunant ensemble, l’idée est arrivée : et si nous créions un espace virtuel pour suivre albums, merch, photocards et inclusions au même endroit ?",
      "Se promener avec des binders à 9 cases dans les boutiques et les événements n’est pas pratique, et les claims de GOM ou les annonces de trade tombent toujours au pire moment. Un espace numérique pour vérifier vite s’il faut claim une PC peut sauver la mise — ou l’argent du prochain concert, qui sommes-nous pour juger ?",
    ],
    codeTitle: "Le chemin derrière le code",
    code: [
      "MyKpopBinder est né ainsi. Ou, du moins, l’idée. Ensuite, des mois d’apprentissage et de travail pour transformer ce rêve en réalité.",
      "Aucune de nous n’a de formation en informatique, en web design ou en programmation. Nous avons nos vies, nos métiers et nos responsabilités en dehors de ce projet. Nous y avons mis le cœur, par amour (et par nécessité) et par passion. Nous avons tout appris depuis zéro, rassemblé autant de données que possible et passé des heures à peaufiner l’expérience.",
      "Il reste énormément à construire, mais il était temps d’ouvrir les portes, de vous inviter dans ce chemin et de grandir ensemble.",
    ],
    visionTitle: "Notre vision et la communauté",
    vision: [
      "Pour nous, être STAY, c’est faire partie d’une famille chaleureuse et d’une communauté qui se soutient. Nous voulons apporter exactement ce sentiment à MyKpopBinder.",
      "Nous voulons une plateforme sûre, accueillante et inclusive, où chacun peut s’exprimer, partager l’amour de ses groupes et être qui il veut. Le respect et l’acceptation sont les piliers du projet.",
      "Pour l’instant, la plateforme est surtout centrée sur Stray Kids, mais, à mesure que l’équipe et la communauté grandissent, le but est d’ajouter autant de groupes que possible, avec votre aide et vos retours.",
      "Rejoignez d’autres fans pour collectionner, suivre, échanger et explorer tout ce que le K-pop a à offrir. Sentez-vous chez vous, et laissez libre cours à votre passion dans une communauté sans jugement.",
    ],
    close: "MyKpopBinder — ton K-space en sécurité.",
    love: "Avec tout notre amour,",
    team: "L’équipe MyKpopBinder : P.A.S.",
  },
  de: {
    kicker: "MY K-POP BINDER",
    title: "Über uns",
    subtitle: "Die Geschichte hinter MyKpopBinder",
    greeting: "MKBees, STAY (und alle anderen K-Pop-Fans und Sammler), annyeong!",
    welcome: "Wir sind überglücklich, euch endlich bei MyKpopBinder willkommen zu heißen. Diese Plattform haben Fans für Fans gebaut, aus Liebe, Hingabe und einer gemeinsamen Leidenschaft für die Welt des K-Pop.",
    whoTitle: "Wer wir sind",
    who: [
      "Wir sind drei K-Pop-Begeisterte aus Spanien, die um 2024 richtig in diesem Universum angekommen sind, auch wenn eine von uns schon um 2015 über BTS zum K-Pop kam. Aus der Bewunderung für die Musik wurde schnell eine enge Freundschaft, getragen von unserer gemeinsamen Liebe zu Stray Kids.",
      "Im Herzen sind wir STAYs, aber unser Geschmack wächst weiter: Eine von uns kommt von ARMY, und zusammen fallen wir gerade auf Gruppen wie ATEEZ, Xdinary Heroes und viele mehr.",
    ],
    startTitle: "Wie alles anfing",
    start: [
      "Bei unseren ersten Schritten als Baby-STAYs sind wir auf ein riesiges Problem gestoßen: Warum und wie gibt es so viel zu sammeln?",
      "Album-Photocards, Pre-Order Benefits (POBs), Lucky Draws, Merch-Inclusions ... wir haben sogar herausgefunden, dass Photocards mit Sonnencreme kommen können!",
      "Daraus wurde Problem Nummer zwei: wie wild bestellen, alles wollen, in über 500 Group Orders (GOs) einsteigen und am Ende Duplikate, vergessene Claims und null Überblick haben, was wir gekauft hatten und woher es kam (denn da waren wir alle schon).",
      "Eines Tages, beim gemeinsamen Mittagessen, kam die Idee: Warum nicht einen virtuellen Ort bauen, an dem Alben, Merch, Photocards und Inclusions an einem Platz zusammenlaufen?",
      "Mit schweren 9er-Bindern zu Shops und Events zu laufen ist unpraktisch, und GOM-Claims oder Trade-Ankündigungen kommen immer im ungünstigsten Moment. Ein digitaler Ort, um schnell zu prüfen, ob man eine PC claimen soll, kann ein Lebensretter sein — oder das Geld für das nächste Konzert, wer sind wir, das zu bewerten?",
    ],
    codeTitle: "Der Weg hinter dem Code",
    code: [
      "So wurde MyKpopBinder geboren. Zumindest die Idee. Danach kamen viele Monate Lernen und Arbeit, um diesen Traum wahr zu machen.",
      "Keine von uns hat eine Ausbildung in Informatik, Webdesign oder Programmierung. Wir haben unser Leben, unsere Jobs und Verantwortung neben diesem Projekt. Trotzdem haben wir unser Herz hineingelegt, aus Liebe (und Notwendigkeit) und aus Leidenschaft. Wir haben alles von null gelernt, so viele Daten wie möglich gesammelt und unzählige Stunden an der Erfahrung gefeilt.",
      "Es gibt noch so viel zu bauen, aber es war Zeit, die Türen zu öffnen, euch auf diesen Weg einzuladen und gemeinsam weiterzuwachsen.",
    ],
    visionTitle: "Unsere Vision und die Community",
    vision: [
      "Für uns heißt STAY sein, zu einer warmen Familie und einer Community zu gehören, die sich stützt. Genau dieses Gefühl wollen wir auf MyKpopBinder übertragen.",
      "Wir wollen einen sicheren, offenen und inklusiven Ort, an dem sich jede Person ausdrücken, ihre Gruppen lieben und sie selbst sein kann. Gegenseitiger Respekt und Akzeptanz sind die Säulen dieses Projekts.",
      "Gerade liegt der Fokus vor allem auf Stray Kids. Wenn Team und Community wachsen, wollen wir mit eurer Hilfe und eurem Feedback so viele Gruppen wie möglich dazunehmen.",
      "Sammelt, behaltet den Überblick, tradet und entdeckt mit anderen Fans alles, was K-Pop zu bieten hat. Fühlt euch zu Hause und lasst eure Leidenschaft in einer Community ohne Urteil frei.",
    ],
    close: "MyKpopBinder — dein sicherer K-space.",
    love: "Mit all unserer Liebe,",
    team: "Das MyKpopBinder-Team: P.A.S.",
  },
  it: {
    kicker: "MY K-POP BINDER",
    title: "Chi siamo",
    subtitle: "La storia di MyKpopBinder",
    greeting: "MKBees, STAY (e tutti i fan e i collezionisti di K-pop), annyeong!",
    welcome: "Siamo felicissime di darvi finalmente il benvenuto su MyKpopBinder. Questa piattaforma l’abbiamo creata fan, per i fan, per amore, dedizione e una passione condivisa per il mondo del K-pop.",
    whoTitle: "Chi siamo",
    who: [
      "Siamo tre appassionate di K-pop che vivono in Spagna e che sono entrate davvero in questo universo intorno al 2024, anche se una di noi conosceva già il K-pop tramite i BTS dal 2015 circa. L’ammirazione per la musica è diventata in fretta un’amicizia forte, intorno all’amore che condividiamo per gli Stray Kids.",
      "Nel cuore siamo STAY, ma i gusti continuano a crescere: una di noi arriva da ARMY, e insieme stiamo cadendo in gruppi incredibili come ATEEZ, Xdinary Heroes e molti altri.",
    ],
    startTitle: "Come è iniziato tutto",
    start: [
      "Nei nostri primi passi da baby STAY ci siamo scontrate con un problema enorme: perché, e come, c’è così tanta roba da collezionare?",
      "Photocard degli album, pre-order benefits (POB), lucky draw, inclusion del merch... abbiamo persino scoperto che le photocard possono arrivare con la crema solare!",
      "Da lì il problema numero due: ordinare senza freni, volere tutto, entrare in più di 500 group order (GO) e ritrovarsi con doppioni, claim dimenticati e zero idea di cosa avessimo comprato e da dove arrivasse (perché ci siamo passate tutte).",
      "Un giorno, a pranzo insieme, è arrivata l’idea: e se creassimo uno spazio virtuale per tenere album, merch, photocard e inclusion in un solo posto?",
      "Girare con binder da 9 tasche nei negozi e agli eventi non è pratico, e i claim dei GOM o gli annunci di trade arrivano sempre nel momento peggiore. Uno spazio digitale per controllare in fretta se fare il claim di una PC può salvarti la vita — o i soldi del prossimo concerto, chi siamo noi per giudicare?",
    ],
    codeTitle: "Il viaggio dietro al codice",
    code: [
      "Così è nato MyKpopBinder. O almeno l’idea. Poi sono arrivati molti mesi di studio e di lavoro per trasformare quel sogno in realtà.",
      "Nessuna di noi ha una formazione in informatica, web design o programmazione. Abbiamo le nostre vite, i nostri lavori e responsabilità fuori da questo progetto. Ci abbiamo messo il cuore, per amore (e necessità) e per passione. Abbiamo imparato tutto da zero, raccolto tutti i dati possibili e passato ore a rifinire l’esperienza.",
      "C’è ancora tantissimo da costruire, ma era ora di aprire le porte, invitarvi in questo percorso e crescere insieme.",
    ],
    visionTitle: "La nostra visione e la community",
    vision: [
      "Per noi, essere STAY significa far parte di una famiglia calorosa e di una community che si sostiene. Vogliamo portare esattamente questa sensazione su MyKpopBinder.",
      "Vogliamo una piattaforma sicura, accogliente e inclusiva, dove ognuno possa esprimersi, condividere l’amore per i propri gruppi ed essere chi vuole. Il rispetto e l’accettazione sono i pilastri di questo progetto.",
      "Ora la piattaforma è soprattutto su Stray Kids, ma, man mano che team e community crescono, l’obiettivo è aggiungere quanti più gruppi possibile, con il vostro aiuto e i vostri commenti.",
      "Unitevi ad altri fan per collezionare, tenere traccia, fare trade ed esplorare tutto quello che il K-pop offre. Sentitevi a casa e lasciate libera la vostra passione in una community senza giudizi.",
    ],
    close: "MyKpopBinder — il tuo K-space sicuro.",
    love: "Con tutto il nostro amore,",
    team: "Il team di MyKpopBinder: P.A.S.",
  },
  pt: {
    kicker: "MY K-POP BINDER",
    title: "Sobre nós",
    subtitle: "A história do MyKpopBinder",
    greeting: "MKBees, STAY (e o resto dos fãs e colecionadores de K-pop), annyeong!",
    welcome: "Estamos felizes e entusiasmadas por vos dar finalmente as boas-vindas ao MyKpopBinder. Esta plataforma foi criada por fãs, para fãs, por amor, dedicação e uma paixão partilhada pelo mundo do K-pop.",
    whoTitle: "Quem somos",
    who: [
      "Somos três entusiastas de K-pop em Espanha que criámos uma ligação a sério com este universo por volta de 2024, embora uma de nós já tivesse chegado ao K-pop através dos BTS por volta de 2015. A admiração pela música transformou-se depressa numa amizade forte, à volta do amor que partilhamos pelos Stray Kids.",
      "No fundo somos STAYs, mas o gosto continua a crescer: uma de nós vem de ARMY, e juntas estamos a cair em grupos incríveis como ATEEZ, Xdinary Heroes e muitos mais.",
    ],
    startTitle: "Como tudo começou",
    start: [
      "Nos primeiros passos como baby STAYs, esbarrámos num problema enorme: porquê, e como, há tanta coisa para colecionar?",
      "Photocards de álbum, pre-order benefits (POBs), lucky draws, inclusões de merch... até descobrimos que as photocards podem vir com protetor solar!",
      "Daí o problema número dois: encomendar sem parar, querer tudo, entrar em mais de 500 group orders (GOs) e acabar com duplicados, claims esquecidos e zero ideia do que tínhamos comprado ou de onde vinha (porque todas já passámos por isso).",
      "Um dia, ao almoço, surgiu a ideia: e se criássemos um espaço virtual para acompanhar álbuns, merch, photocards e inclusões num só sítio?",
      "Andar com binders de 9 espaços pelas lojas e eventos não é prático, e os claims de GOM ou os anúncios de trade aparecem sempre na pior altura. Um espaço digital para ver depressa se deves fazer claim de uma PC pode salvar-te a vida — ou o dinheiro do próximo concerto, quem somos nós para julgar?",
    ],
    codeTitle: "O caminho por trás do código",
    code: [
      "Assim nasceu o MyKpopBinder. Ou, pelo menos, a ideia. Seguiram-se muitos meses de aprendizagem e de trabalho para transformar esse sonho em realidade.",
      "Nenhuma de nós tem formação em informática, web design ou programação. Temos as nossas vidas, trabalhos e responsabilidades fora deste projeto. Mesmo assim, pusemos o coração nesta plataforma por amor (e necessidade) e por paixão. Aprendemos tudo do zero, reunimos os dados que conseguimos e passámos horas a afinar a experiência.",
      "Ainda há muito por construir, mas sentimos que era altura de abrir as portas, convidar-vos para este caminho e continuar a crescer juntas.",
    ],
    visionTitle: "A nossa visão e a comunidade",
    vision: [
      "Para nós, ser STAY é fazer parte de uma família próxima e de uma comunidade que se apoia. Queremos levar exatamente esse sentimento ao MyKpopBinder.",
      "Queremos uma plataforma segura, acolhedora e inclusiva, onde cada pessoa se expresse, partilhe o amor pelos seus grupos e seja quem quiser ser. O respeito e a aceitação são os pilares deste projeto.",
      "Neste momento a plataforma está sobretudo centrada nos Stray Kids, mas, à medida que a equipa e a comunidade crescerem, o objetivo é acrescentar o máximo de grupos possível, com a vossa ajuda e os vossos comentários.",
      "Juntem-se a outros fãs para colecionar, acompanhar, trocar e explorar tudo o que o K-pop tem para oferecer. Sintam-se em casa e deixem a paixão livre numa comunidade sem julgamentos.",
    ],
    close: "MyKpopBinder — o teu K-space seguro.",
    love: "Com todo o nosso amor,",
    team: "A equipa MyKpopBinder: P.A.S.",
  },
  id: {
    kicker: "MY K-POP BINDER",
    title: "Tentang kami",
    subtitle: "Cerita di balik MyKpopBinder",
    greeting: "MKBees, STAY (dan semua penggemar serta kolektor K-pop), annyeong!",
    welcome: "Kami sangat bahagia akhirnya bisa menyambutmu di MyKpopBinder. Platform ini dibuat oleh fans, untuk fans, dari rasa cinta, dedikasi, dan passion yang sama pada dunia K-pop.",
    whoTitle: "Siapa kami",
    who: [
      "Kami tiga penggemar K-pop yang tinggal di Spanyol dan benar-benar masuk ke dunia ini sekitar 2024, meskipun salah satu dari kami sudah mengenal K-pop lewat BTS sejak sekitar 2015. Kekaguman pada musiknya cepat berubah menjadi persahabatan yang erat, karena cinta yang sama pada Stray Kids.",
      "Di hati kami STAY, tapi selera musik terus bertambah: salah satu dari kami berangkat dari ARMY, dan bersama-sama kami jatuh pada grup luar biasa seperti ATEEZ, Xdinary Heroes, dan banyak lagi.",
    ],
    startTitle: "Bagaimana semuanya dimulai",
    start: [
      "Di langkah pertama sebagai baby STAY, kami langsung menabrak satu masalah besar: kenapa, dan bagaimana, ada begitu banyak yang harus dikoleksi?",
      "Photocard album, pre-order benefit (POB), lucky draw, inclusion merch... kami bahkan menemukan bahwa photocard bisa datang bersama tabir surya!",
      "Dari situ muncul masalah kedua: memesan tanpa henti, ingin semuanya, ikut lebih dari 500 group order (GO), lalu berakhir dengan duplikat, claim yang terlupakan, dan tidak tahu apa yang sudah dibeli atau dari mana asalnya (karena kita semua pernah di situ).",
      "Suatu hari, saat makan siang bersama, idenya muncul: bagaimana kalau ada ruang virtual untuk mencatat album, merch, photocard, dan inclusion di satu tempat?",
      "Membawa binder 9 slot ke toko dan event itu tidak praktis, dan claim GOM atau pengumuman trade selalu muncul di saat yang paling tidak tepat. Ruang digital untuk cepat mengecek apakah sebuah PC perlu di-claim bisa menyelamatkan hari — atau uang untuk konser berikutnya, siapa kami untuk menilai?",
    ],
    codeTitle: "Perjalanan di balik kodenya",
    code: [
      "Begitulah MyKpopBinder lahir. Setidaknya, idenya. Setelah itu berbulan-bulan belajar dan bekerja untuk mengubah mimpi itu jadi nyata.",
      "Tidak ada di antara kami yang berlatar ilmu komputer, desain web, atau pemrograman. Kami punya hidup, pekerjaan, dan tanggung jawab di luar proyek ini. Tetap saja kami menaruh hati di platform ini karena cinta (dan kebutuhan) serta passion. Kami belajar semuanya dari nol, mengumpulkan data sebanyak yang kami bisa, dan menghabiskan waktu lama menyempurnakan pengalamannya.",
      "Masih banyak yang harus dibangun, tapi kami merasa sudah waktunya membuka pintu, mengajakmu dalam perjalanan ini, dan tumbuh bersama.",
    ],
    visionTitle: "Visi dan komunitas kami",
    vision: [
      "Bagi kami, menjadi STAY artinya menjadi bagian dari keluarga yang hangat dan komunitas yang saling mendukung. Perasaan itulah yang ingin kami bawa ke MyKpopBinder.",
      "Kami ingin platform ini aman, ramah, dan inklusif, tempat setiap orang bebas mengekspresikan diri, berbagi cinta pada grup favoritnya, dan menjadi dirinya sendiri. Saling menghormati dan menerima adalah pilar proyek ini.",
      "Saat ini platform masih berfokus pada Stray Kids, tetapi seiring tim dan komunitas bertumbuh, tujuan kami adalah menambah sebanyak mungkin grup, dengan bantuan dan masukanmu.",
      "Bergabunglah dengan fans lain untuk mengoleksi, mencatat, trade, dan menjelajahi semua yang ditawarkan dunia K-pop. Rasakan seperti di rumah, dan biarkan passionmu bebas di komunitas tanpa penghakiman.",
    ],
    close: "MyKpopBinder — K-space aman milikmu.",
    love: "Dengan segenap cinta kami,",
    team: "Tim MyKpopBinder: P.A.S.",
  },
  th: {
    kicker: "MY K-POP BINDER",
    title: "เกี่ยวกับเรา",
    subtitle: "เรื่องราวเบื้องหลัง MyKpopBinder",
    greeting: "MKBees, STAY (และแฟนกับนักสะสมเคป็อปทุกคน) annyeong!",
    welcome: "เราดีใจและตื่นเต้นมากที่ได้ต้อนรับคุณเข้าสู่ MyKpopBinder ในที่สุด แพลตฟอร์มนี้สร้างโดยแฟน เพื่อแฟน จากความรัก ความตั้งใจ และ passion ที่มีร่วมกันต่อโลกของเคป็อป",
    whoTitle: "เราเป็นใคร",
    who: [
      "เราเป็นแฟนเคป็อปสามคนที่อยู่สเปน และผูกพันกับโลกนี้จริง ๆ ราวปี 2024 แม้หนึ่งในเราจะรู้จักเคป็อปผ่าน BTS มาตั้งแต่ราวปี 2015 สิ่งที่เริ่มจากความชื่นชมในเพลงกลายเป็นมิตรภาพที่แน่นแฟ้น เพราะความรักที่มีร่วมกันต่อ Stray Kids",
      "ในใจเราเป็น STAY แต่รสนิยมยังโตต่อ: คนหนึ่งมาจาก ARMY และตอนนี้เรากำลังตกหลุมรักวงอย่าง ATEEZ, Xdinary Heroes และอีกหลายวงไปด้วยกัน",
    ],
    startTitle: "ทุกอย่างเริ่มยังไง",
    start: [
      "ระหว่างก้าวแรกในฐานะ baby STAY เราเจอปัญหาใหญ่ทันที: ทำไม และยังไง ถึงมีของให้สะสมมากขนาดนี้?",
      "โฟโต้การ์ดอัลบั้ม, pre-order benefit (POB), lucky draw, ของแถม merch... เรายังเพิ่งรู้ว่าโฟโต้การ์ดมาพร้อมครีมกันแดดได้ด้วย!",
      "นั่นนำไปสู่ปัญหาที่สอง: สั่งไม่หยุด อยากได้ทุกอย่าง เข้า group order (GO) มากกว่า 500 ครั้ง แล้วจบด้วยของซ้ำ claim ที่ลืม และไม่รู้เลยว่าซื้ออะไรไปบ้างหรือของจะมาจากไหน (เพราะเราทุกคนเคยผ่านจุดนั้น)",
      "วันหนึ่งระหว่างกินข้าวด้วยกัน ไอเดียก็มา: ถ้ามีพื้นที่เสมือนไว้ตามอัลบั้ม merch โฟโต้การ์ด และ inclusion ในที่เดียวล่ะ?",
      "แบกไบน์เดอร์ 9 ช่องไปร้านและงานอีเวนต์ไม่สะดวกเลย และ claim ของ GOM หรือประกาศเทรดก็โผล่มาตอนที่แย่ที่สุดเสมอ พื้นที่ดิจิทัลที่เช็กได้เร็วว่าควร claim PC ใบนั้นไหมช่วยชีวิตได้ — หรือช่วยเงินคอนเสิร์ตครั้งหน้า เราจะไปตัดสินใครได้ลงคอ",
    ],
    codeTitle: "ทางที่อยู่เบื้องหลังโค้ด",
    code: [
      "MyKpopBinder เกิดแบบนั้น หรืออย่างน้อยก็ไอเดียของมัน จากนั้นคือการเรียนและการทำงานอีกหลายเดือนเพื่อทำให้ความฝันเป็นจริง",
      "ไม่มีใครในเราเรียนคอมพิวเตอร์ ออกแบบเว็บ หรือเขียนโปรแกรมมาโดยตรง เรามีชีวิต งาน และหน้าที่นอกโปรเจกต์นี้ แต่เราใส่ใจทั้งดวงลงไปในแพลตฟอร์มนี้เพราะรัก (และเพราะจำเป็น) และเพราะ passion เราเรียนทุกอย่างตั้งแต่ศูนย์ เก็บข้อมูลเท่าที่ทำได้ และใช้เวลาอีกนานเพื่อเกลาประสบการณ์",
      "ยังมีอะไรต้องสร้างอีกมาก แต่เรารู้สึกว่าถึงเวลาเปิดประตู ชวนคุณเข้ามาในทางนี้ และโตไปด้วยกัน",
    ],
    visionTitle: "วิสัยทัศน์และชุมชนของเรา",
    vision: [
      "สำหรับเรา การเป็น STAY คือการเป็นส่วนหนึ่งของครอบครัวที่อบอุ่นและชุมชนที่ซัพพอร์ตกัน เราอยากส่งความรู้สึกนั้นมาที่ MyKpopBinder",
      "เราอยากให้ที่นี่ปลอดภัย เป็นมิตร และเปิดกว้าง ให้ทุกคนแสดงตัว แบ่งปันความรักที่มีต่อวงที่รัก และเป็นในแบบที่อยากเป็น ความเคารพและการยอมรับคือเสาหลักของโปรเจกต์นี้",
      "ตอนนี้แพลตฟอร์มโฟกัสที่ Stray Kids เป็นหลัก แต่เมื่อทีมและชุมชนโตขึ้น เป้าหมายคือเพิ่มให้ได้มากวงที่สุด ด้วยความช่วยเหลือและฟีดแบ็กของคุณ",
      "มาร่วมกับแฟนคนอื่นเพื่อสะสม ติดตาม เทรด และสำรวจทุกอย่างที่โลกเคป็อปมีให้ รู้สึกเหมือนอยู่บ้าน และปล่อย passion ได้อย่างอิสระในชุมชนที่ไม่ตัดสินใคร",
    ],
    close: "MyKpopBinder — K-space ที่ปลอดภัยของคุณ",
    love: "ด้วยรักทั้งหมดของเรา",
    team: "ทีม MyKpopBinder: P.A.S.",
  },
  ja: {
    kicker: "MY K-POP BINDER",
    title: "私たちについて",
    subtitle: "MyKpopBinder ができるまで",
    greeting: "MKBees、STAY（そしてすべての K-Pop ファンとコレクター）のみなさん、annyeong!",
    welcome: "やっと MyKpopBinder へようこそ、と言えて本当にうれしいです。この場所は、ファンがファンのために、K-Pop への愛と時間と情熱だけを持って作りました。",
    whoTitle: "私たちについて",
    who: [
      "私たちはスペインにいる K-Pop 好きの 3 人です。この世界と本格的につながったのは 2024 年頃ですが、ひとりは 2015 年頃に BTS から K-Pop に入っていました。音楽への憧れはすぐに、Stray Kids への共通の愛を中心にした強い友情になりました。",
      "心はほとんど STAY です。それでも好みは広がり続けていて、ひとりは ARMY としての時間が長く、今は ATEEZ や Xdinary Heroes など、すごいグループに一緒に落ちていっています。",
    ],
    startTitle: "はじまり",
    start: [
      "baby STAY としてこの世界に足を踏み入れたすぐあと、大きな問題にぶつかりました。なんで、どうして、集めるものがこんなにあるの？",
      "アルバムのトレカ、先行特典（POB）、ラキドロ、マーチの封入物……トレカが日焼け止めと一緒に届くことまで知りました。",
      "そこから問題その 2。欲しくて注文しまくり、500 を超えるグループオーダー（GO）に入って、ダブりと忘れたクレームと、何を買ったのかもどこから来るのかも分からない状態になりました。誰もが通る道です。",
      "ある日、一緒にランチをしていたときに思いつきました。アルバムもマーチもトレカも封入物も、ひとつの場所で追えたらいいのに。",
      "9 ポケットのバインダーを抱えてショップやイベントを回るのは現実的じゃないし、GOM のクレームやトレードの告知はいつも一番まずいタイミングで来ます。その PC をクレームすべきか、すぐ確認できる場所は命綱です。次のコンサート代が残る、と言ってもいい。どっちと呼ぶかは、私たちが決めることではありません。",
    ],
    codeTitle: "コードの向こうにあった道",
    code: [
      "そうして MyKpopBinder が生まれました。少なくとも、そのアイデアが。そのあとは、夢を形にするための長い学びと作業が続きました。",
      "私たちにコンピュータ、ウェブデザイン、プログラミングの専門教育はありません。このプロジェクトの外に、それぞれの生活と仕事と責任があります。それでも、愛と（必要に迫られて）情熱で、この場所に心を注ぎました。ゼロから学び、集められるデータを集め、体験を整えるために何時間も使いました。",
      "まだ作るものはたくさんあります。それでも、扉を開けて、この旅にあなたを招き、一緒に育っていくタイミングだと感じました。",
    ],
    visionTitle: "ビジョンとコミュニティ",
    vision: [
      "私たちにとって STAY であることは、あたたかい家族と、支え合うコミュニティの一員であることです。その感覚を、そのまま MyKpopBinder に広げたい。",
      "ここは安全で、歓迎されて、誰もが自分を出して、好きなグループへの愛を共有して、なりたい自分でいられる場所にしたい。尊重し合うことと、受け入れることが、このプロジェクトの柱です。",
      "今は主に Stray Kids が中心です。チームとコミュニティが育つにつれて、あなたの助けと声を聞きながら、できるだけ多くのグループを加えていきます。",
      "集めて、記録して、トレードして、K-Pop の世界にあるものを一緒に探検しましょう。友だちの家にいるように、判断のないコミュニティで情熱を自由にどうぞ。",
    ],
    close: "MyKpopBinder — あなたの安全な K-space。",
    love: "愛をこめて、",
    team: "MyKpopBinder チーム: P.A.S.",
  },
  ko: {
    kicker: "MY K-POP BINDER",
    title: "우리 이야기",
    subtitle: "MyKpopBinder가 생긴 이유",
    greeting: "MKBees, STAY, 그리고 모든 K-Pop 팬과 컬렉터 여러분, annyeong!",
    welcome: "드디어 MyKpopBinder에 여러분을 맞이하게 되어 정말 기쁩니다. 이 공간은 팬이 팬을 위해, K-Pop을 사랑하는 마음과 시간과 정성만으로 만들었습니다.",
    whoTitle: "우리는",
    who: [
      "우리는 스페인에 있는 K-Pop을 좋아하는 세 사람입니다. 이 세계와 제대로 만난 건 2024년쯤이지만, 한 명은 2015년쯤 BTS를 통해 이미 K-Pop을 알고 있었습니다. 음악에 대한 마음은 금세 Stray Kids를 함께 사랑하는 단단한 우정이 되었습니다.",
      "마음의 중심은 STAY입니다. 취향은 계속 넓어지고 있어요. 한 명은 ARMY로 오래 있었고, 지금은 ATEEZ, Xdinary Heroes처럼 멋진 팀들에 함께 빠져 있습니다.",
    ],
    startTitle: "시작",
    start: [
      "baby STAY로 이 세계에 들어선 직후, 거대한 문제를 만났습니다. 대체 왜, 어떻게, 모을 것이 이렇게 많은 걸까요?",
      "앨범 포토카드, 선주문 특전(POB), 럭키드로우, 머치 구성품…… 포토카드가 선크림과 함께 온다는 것까지 알게 되었습니다.",
      "그래서 두 번째 문제. 원한다는 이유로 계속 주문하고, 500개가 넘는 그룹오더(GO)에 들어가고, 중복과 잊어버린 클레임, 그리고 무엇을 샀는지 어디서 오는지조차 모르는 상태가 되었습니다. 우리 모두 그 길을 지나왔습니다.",
      "어느 날 함께 점심을 먹다가 떠올랐습니다. 앨범, 머치, 포토카드, 구성품을 한곳에서 기록할 수 있는 공간이 있으면 어떨까.",
      "9칸 바인더를 들고 샵과 행사를 다니는 일은 현실적이지 않고, GOM 클레임이나 트레이드 공지는 늘 가장 바쁜 순간에 뜹니다. 그 PC를 클레임해야 하는지 바로 확인할 곳이 있으면 정말 살림이 됩니다. 다음 콘서트 돈을 아낀다고 해도 좋고요. 어느 쪽으로 불러도, 우리가 판단할 일은 아닙니다.",
    ],
    codeTitle: "코드 뒤의 시간",
    code: [
      "그렇게 MyKpopBinder가 태어났습니다. 적어도 그 아이디어가. 그 뒤는 꿈을 현실로 만들기 위한 긴 배움과 작업이었습니다.",
      "우리 중 누구도 컴퓨터, 웹 디자인, 프로그래밍을 전공하지 않았습니다. 이 프로젝트 밖에는 각자의 삶과 일과 책임이 있습니다. 그래도 사랑과 필요, 그리고 애정 때문에 마음을 다 넣었습니다. 처음부터 배우고, 모을 수 있는 데이터를 모으고, 경험을 다듬는 데 시간을 아주 많이 썼습니다.",
      "아직 만들 것이 많습니다. 그래도 문을 열고, 이 여정에 당신을 초대하고, 함께 커 갈 때라고 느꼈습니다.",
    ],
    visionTitle: "우리가 바라는 커뮤니티",
    vision: [
      "우리에게 STAY라는 것은 따뜻한 가족과 서로를 받치는 커뮤니티의 일원이라는 뜻입니다. 그 느낌을 그대로 MyKpopBinder에 두고 싶습니다.",
      "여기는 안전하고, 환영받고, 누구나 자신을 드러내고, 좋아하는 팀을 사랑하고, 되고 싶은 사람으로 있을 수 있는 곳이었으면 합니다. 서로 존중하고 받아들이는 일이 이 프로젝트의 기둥입니다.",
      "지금은 주로 Stray Kids에 집중하고 있습니다. 팀과 커뮤니티가 자라면, 여러분의 도움과 이야기를 들으며 가능한 한 많은 팀을 더할 것입니다.",
      "모으고, 기록하고, 트레이드하고, K-Pop 세계에 있는 것들을 함께 살펴요. 친구 집에 온 것처럼, 판단 없는 커뮤니티에서 마음을 자유롭게 두세요.",
    ],
    close: "MyKpopBinder — 당신의 안전한 K-space.",
    love: "우리의 마음을 담아,",
    team: "MyKpopBinder 팀: P.A.S.",
  },
  zh: {
    kicker: "MY K-POP BINDER",
    title: "关于我们",
    subtitle: "MyKpopBinder 背后的故事",
    greeting: "MKBees、STAY，以及所有 K-Pop 粉丝和收藏者，annyeong！",
    welcome: "终于能欢迎你来到 MyKpopBinder，我们真的又高兴又激动。这个平台是粉丝为粉丝做的，出于爱、投入，以及对 K-Pop 世界共同的热情。",
    whoTitle: "我们是谁",
    who: [
      "我们是三个住在西班牙的 K-Pop 爱好者，大约在 2024 年真正走进这个世界，不过我们中的一个人早在 2015 年前后就通过 BTS 接触了 K-Pop。对音乐的喜欢很快变成一段结实的友谊，中心是我们共同热爱的 Stray Kids。",
      "心里主要还是 STAY，口味还在继续变宽：其中一个人是从 ARMY 走过来的，现在我们一起掉进了 ATEEZ、Xdinary Heroes，还有更多很棒的组合。",
    ],
    startTitle: "一切怎么开始",
    start: [
      "刚成为 baby STAY 的时候，我们马上撞上一个大问题：为什么、又到底怎么会有这么多东西要收藏？",
      "专辑小卡、预购特典（POB）、抽卡、周边内页……我们甚至发现小卡可以和防晒霜一起出现。",
      "于是有了第二个问题：拼命下单，什么都想要，加入超过 500 个团购（GO），最后手里是重复、忘掉的 claim，以及完全不知道自己买了什么、东西从哪来（因为我们都经历过）。",
      "有一天一起吃午饭，想法出现了：为什么不做一个虚拟的地方，把专辑、周边、小卡和内含物放在一处记录？",
      "抱着九宫格卡册去店里和活动现场并不方便，GOM 的 claim 和交易通知也总在最不合适的时候冒出来。有一个地方能马上确认要不要 claim 这张 PC，真的能救命——或者说，能把钱留给下一场演唱会。怎么叫，不是我们来评判的。",
    ],
    codeTitle: "代码背后的路",
    code: [
      "MyKpopBinder 就这样诞生了。至少，是这个想法。后面是很多个月的学习和工作，把梦做成真的。",
      "我们都没有计算机、网页设计或编程的专业背景。项目之外，每个人都有自己的生活、工作和责任。我们还是把心放了进来，因为爱（也因为需要），因为热情。一切从零学起，能收集的资料都收集了，又花了很长时间打磨体验。",
      "要做的事还有很多。我们觉得，是时候开门，邀请你一起走，然后继续一起长大。",
    ],
    visionTitle: "我们的愿景和社区",
    vision: [
      "对我们来说，做 STAY 就是成为一个温暖家庭、一个彼此支持的社区的一员。我们想把这种感觉原样带到 MyKpopBinder。",
      "我们希望这里安全、被人欢迎、包容。每个人都可以表达自己，分享对喜欢组合的爱，做自己想成为的人。互相尊重和接纳，是这个项目的柱子。",
      "现在平台主要围绕 Stray Kids。随着团队和社区长大，我们的目标是在你们的帮助和反馈下，加入尽可能多的组合。",
      "来和其他粉丝一起收藏、记录、交换、探索 K-Pop 世界里的一切。像在朋友家里一样，在一个不被评判的社区里，把热情放开。",
    ],
    close: "MyKpopBinder — 你的安全 K-space。",
    love: "带着我们全部的爱，",
    team: "MyKpopBinder 团队：P.A.S.",
  },
};

const artist: Record<EditorialLang, ArtistCopy> = {
  es: {
    headline: "Stray Kids: Los arquitectos de su propio éxito en el K-pop",
    history: [
      "Desde su debut oficial en 2018, Stray Kids (SKZ) ha reescrito las reglas de la industria musical surcoreana al rechazar la fórmula del ídolo prefabricado. Gestados en JYP Entertainment a través de un exigente programa de supervivencia, su formación fue completamente atípica: Bang Chan, el líder del grupo, tuvo la libertad excepcional de seleccionar personalmente a los miembros que lo acompañarían en el proyecto. Esta decisión cimentó una sinergia y un sentido de hermandad que resulta palpable tanto en sus coreografías como en la dinámica del equipo.",
      "La verdadera piedra angular de la identidad de SKZ es su autonomía creativa. La composición, escritura y producción de prácticamente toda su extensa discografía recae en 3RACHA, la subunidad productora integrada por Bang Chan, Changbin y Han. Este nivel de control independiente les ha permitido experimentar sin las ataduras comerciales tradicionales, dando a luz a un estilo musical propio que ellos mismos bautizaron como \"Mala Taste\" (sabor picante).",
      "Este sonido característico se define por bases intensas de EDM, ritmos de hip-hop pesado y estructuras poco convencionales. Lejos de suavizar su propuesta ante los detractores que calificaban sus canciones como simple \"ruido\", el octeto se apropió del término noise music. Lo transformaron en una marca de identidad inconfundible y en un sello de orgullo, conquistando las listas globales con himnos de alto voltaje como \"God's Menu\", \"Thunderous\", \"Maniac\" y \"S-Class\".",
      "El impacto internacional de su propuesta ha establecido récords históricos para la cuarta generación del K-pop. Han logrado coronar la prestigiosa lista Billboard 200 con múltiples álbumes consecutivos y han encabezado como cabezas de cartel algunos de los festivales más importantes del mundo, demostrando que su enfoque audaz tiene un atractivo masivo y transversal.",
      "Para STAY, su dedicado fandom, el mayor atractivo de Stray Kids reside precisamente en esa vulnerabilidad y autenticidad. Tras la reciente renovación anticipada de sus contratos con la agencia, los ocho integrantes han asegurado la expansión de su universo musical, prometiendo a sus seguidores seguir desafiando los límites del pop coreano con su incombustible energía durante muchos años más.",
    ],
    fact: "Aunque muchos fans conocen el apodo \"Baby Bread\" del miembro más joven, I.N, un dato mucho más inusual es que solían llamarlo \"Spoon Worm\" (Gusano cuchara) o \"Spoon Worm Yang\". Este apodo surgió en su primera clase junto a los demás miembros, cuando su profesor de baile le dijo que sus movimientos eran muy tambaleantes y se asemejaban a los de ese animal. Otro dato interesante sobre I.N es que decidió convertirse en cantante después de que unos ancianos le pidieran que cantara música tradicional trot frente a ellos, lo que despertó su gusto por los escenarios.",
    news: [
      "En un movimiento sin precedentes en la industria musical, Stray Kids ha anunciado oficialmente que no presentará su música para la 69.ª edición de los premios Grammy. La decisión, confirmada por JYP Entertainment tras el cierre de la fecha límite de presentación el pasado agosto, se suma al boicot iniciado por BTS el pasado mes de julio.",
      "El motivo central de esta protesta masiva es la creación de la nueva categoría \"Mejor Interpretación de Música Pop Asiática\" por parte de la Academia de Grabación. Los grupos surcoreanos denuncian que esta medida los relega a una categoría segregada, separando injustamente el K-pop de los galardones principales. «Esperamos que la música sea escuchada y amada por lo que es, en lugar de ser categorizada por región o idioma», declaró BTS en su momento.",
      "La postura de Stray Kids resulta especialmente contundente dado que los ocho miembros del grupo poseen derechos de voto dentro de la Academia, lo que les permite decidir a los nominados y ganadores a pesar de haberse retirado de la competición. Según informa la BBC, este boicot conjunto supone un duro revés para la credibilidad de los galardones.",
    ],
  },
  en: {
    headline: "Stray Kids: the architects of their own success in K-pop",
    history: [
      "Since their official debut in 2018, Stray Kids (SKZ) have rewritten the rules of the South Korean music industry by refusing the ready-made idol formula. Shaped at JYP Entertainment through a demanding survival program, their lineup was anything but typical: Bang Chan, the group’s leader, was given the rare freedom to personally choose the members who would join him. That decision built a synergy and a sense of brotherhood you can feel in their choreography and in the way the team works.",
      "The real cornerstone of SKZ’s identity is creative autonomy. The writing, composition, and production of almost their entire, extensive discography sit with 3RACHA, the producing subunit of Bang Chan, Changbin, and Han. That independent control let them experiment without the usual commercial restraints and gave birth to a sound they named themselves: “Mala Taste” (spicy flavor).",
      "The sound is built on intense EDM, heavy hip-hop rhythms, and unconventional structures. Instead of softening their music for critics who called it mere “noise,” the eight of them claimed the term noise music. They turned it into an unmistakable identity and a point of pride, topping global charts with high-voltage anthems such as “God's Menu,” “Thunderous,” “Maniac,” and “S-Class.”",
      "The international reach of that approach has set historic records for fourth-generation K-pop. They have topped the Billboard 200 with multiple albums in a row and headlined some of the world’s biggest festivals, showing that a bold sound can travel far beyond one audience.",
      "For STAY, their devoted fandom, the deepest pull of Stray Kids is exactly that vulnerability and authenticity. After renewing their contracts with the agency ahead of schedule, all eight members secured room to keep expanding their musical world, promising fans they will keep pushing the edges of Korean pop with the same unstoppable energy for many years to come.",
    ],
    fact: "Many fans know the youngest member, I.N, as “Baby Bread.” A much stranger nickname is “Spoon Worm,” or “Spoon Worm Yang.” It started in his first class with the other members, when his dance teacher said his movements were so wobbly they looked like that animal. Another detail: I.N decided to become a singer after a group of older people asked him to sing traditional trot in front of them, which woke up his taste for the stage.",
    news: [
      "In a move with little precedent in the music industry, Stray Kids have officially announced that they will not submit their music for the 69th Grammy Awards. JYP Entertainment confirmed the decision after the submission deadline closed last August. It joins the boycott BTS began last July.",
      "At the center of the protest is a new category created by the Recording Academy, Best Asian Pop Music Performance. The Korean groups argue that it places them in a segregated lane and unfairly separates K-pop from the main awards. “We hope music is heard and loved for what it is, rather than categorized by region or language,” BTS said at the time.",
      "Stray Kids’ stance is especially pointed because all eight members hold voting rights inside the Academy, so they can still help decide nominees and winners even after stepping out of the competition. The BBC reports that this joint boycott is a serious blow to the awards’ credibility.",
    ],
  },
  fr: {
    headline: "Stray Kids : les architectes de leur propre succès dans la K-pop",
    history: [
      "Depuis leurs débuts officiels en 2018, Stray Kids (SKZ) ont réécrit les règles de l’industrie musicale sud-coréenne en refusant la formule de l’idole préfabriquée. Façonnés chez JYP Entertainment par un programme de survie exigeant, leur formation est atypique : Bang Chan, le leader, a eu la liberté rare de choisir lui-même les membres qui l’accompagneraient. Cette décision a posé une synergie et un sentiment de fraternité que l’on sent dans leurs chorégraphies comme dans la dynamique du groupe.",
      "La vraie pierre angulaire de l’identité de SKZ, c’est l’autonomie créative. L’écriture, la composition et la production de presque toute leur vaste discographie reviennent à 3RACHA, la sous-unité de Bang Chan, Changbin et Han. Ce contrôle indépendant leur a permis d’expérimenter hors des contraintes commerciales habituelles et a donné un son qu’ils ont eux-mêmes nommé « Mala Taste » (goût épicé).",
      "Ce son repose sur des bases d’EDM intenses, un hip-hop lourd et des structures peu conventionnelles. Loin d’adoucir leur musique face à ceux qui parlaient de simple « bruit », l’octuor s’est approprié le terme noise music. Ils en ont fait une identité reconnaissable et une fierté, en haut des classements mondiaux avec des hymnes à haut voltage comme « God's Menu », « Thunderous », « Maniac » et « S-Class ».",
      "L’impact international de cette proposition a établi des records pour la quatrième génération de la K-pop. Ils ont atteint plusieurs fois de suite la Billboard 200 et ont été têtes d’affiche de certains des plus grands festivals du monde, preuve qu’une approche audacieuse peut parler très largement.",
      "Pour STAY, leur fandom, le plus grand attrait de Stray Kids est justement cette vulnérabilité et cette authenticité. Après le renouvellement anticipé de leurs contrats avec l’agence, les huit membres ont assuré l’expansion de leur univers musical et promis à leurs fans de continuer à pousser les limites de la pop coréenne, avec la même énergie, pendant encore de longues années.",
    ],
    fact: "Beaucoup de fans connaissent le surnom « Baby Bread » du plus jeune, I.N. Un surnom bien plus inattendu est « Spoon Worm » (ver cuillère) ou « Spoon Worm Yang ». Il est né lors de son premier cours avec les autres membres, quand son professeur de danse a dit que ses mouvements étaient si chancelants qu’ils ressemblaient à cet animal. Autre détail : I.N a décidé de devenir chanteur après que des personnes âgées lui ont demandé de chanter du trot traditionnel devant elles, ce qui a éveillé son goût de la scène.",
    news: [
      "Dans un geste rare dans l’industrie musicale, Stray Kids ont annoncé officiellement qu’ils ne présenteraient pas leur musique à la 69e édition des Grammy Awards. JYP Entertainment a confirmé la décision après la clôture des dépôts, en août dernier. Elle rejoint le boycott lancé par BTS en juillet.",
      "Au cœur de cette protestation, la nouvelle catégorie créée par la Recording Academy, Best Asian Pop Music Performance. Les groupes sud-coréens dénoncent une case à part, qui sépare injustement la K-pop des principales récompenses. « Nous espérons que la musique sera écoutée et aimée pour ce qu’elle est, plutôt que classée par région ou par langue », avait déclaré BTS.",
      "La position de Stray Kids est d’autant plus nette que les huit membres ont un droit de vote au sein de l’Académie : ils peuvent encore participer au choix des nommés et des gagnants tout en s’étant retirés de la compétition. Selon la BBC, ce boycott commun porte un coup sérieux à la crédibilité des prix.",
    ],
  },
  de: {
    headline: "Stray Kids: die Architekten ihres eigenen Erfolgs im K-Pop",
    history: [
      "Seit ihrem offiziellen Debüt 2018 haben Stray Kids (SKZ) die Regeln der südkoreanischen Musikindustrie umgeschrieben, indem sie die Formel des fertigen Idols abgelehnt haben. Bei JYP Entertainment in einem harten Survival-Programm geformt, war ihre Besetzung untypisch: Bang Chan, der Leader, durfte die Mitglieder, die ihn begleiten würden, selbst auswählen. Diese Entscheidung hat eine Synergie und ein Gefühl von Brüderlichkeit gelegt, das man in der Choreografie und in der Dynamik des Teams spürt.",
      "Der eigentliche Grundstein der Identität von SKZ ist kreative Autonomie. Komposition, Text und Produktion fast der gesamten, sehr großen Diskografie liegen bei 3RACHA, der Producer-Subunit aus Bang Chan, Changbin und Han. Diese unabhängige Kontrolle ließ sie ohne die üblichen kommerziellen Fesseln experimentieren und brachte einen Sound hervor, den sie selbst „Mala Taste“ (scharfer Geschmack) nannten.",
      "Der Sound steht auf intensivem EDM, schwerem Hip-Hop und ungewöhnlichen Strukturen. Statt ihre Musik für Kritiker weicher zu machen, die sie als bloßes „Rauschen“ bezeichneten, haben sich die acht den Begriff Noise Music angeeignet. Daraus wurde ein unverkennbares Zeichen und ein Stück Stolz, mit Hymnen wie „God's Menu“, „Thunderous“, „Maniac“ und „S-Class“ weltweit in den Charts.",
      "Die internationale Wirkung hat historische Rekorde für die vierte K-Pop-Generation gesetzt. Sie haben die Billboard 200 mit mehreren Alben in Folge angeführt und einige der wichtigsten Festivals der Welt als Headliner eröffnet. Ihr mutiger Ansatz trägt weit über eine einzige Hörerschaft hinaus.",
      "Für STAY, ihr engagiertes Fandom, liegt die größte Anziehung von Stray Kids genau in dieser Verletzlichkeit und Echtheit. Nach der vorgezogenen Vertragsverlängerung mit der Agentur haben alle acht Mitglieder Raum für die Erweiterung ihres musikalischen Universums gesichert und ihren Fans versprochen, die Grenzen des koreanischen Pop noch viele Jahre mit derselben Energie zu verschieben.",
    ],
    fact: "Viele Fans kennen den jüngsten, I.N, als „Baby Bread“. Ein viel ungewöhnlicheres Spitzname ist „Spoon Worm“ (Löffelwurm) oder „Spoon Worm Yang“. Er entstand in seiner ersten Stunde mit den anderen Mitgliedern, als der Tanzlehrer sagte, seine Bewegungen seien so wackelig, dass sie diesem Tier ähnelten. Noch etwas: I.N beschloss, Sänger zu werden, nachdem ältere Menschen ihn baten, vor ihnen traditionellen Trot zu singen. Das weckte seine Lust an der Bühne.",
    news: [
      "In einem in der Musikindustrie seltenen Schritt haben Stray Kids offiziell angekündigt, ihre Musik nicht für die 69. Grammy Awards einzureichen. JYP Entertainment bestätigte die Entscheidung nach dem Ende der Einreichungsfrist im vergangenen August. Sie schließt sich dem Boykott an, den BTS im Juli begonnen hat.",
      "Im Zentrum des Protests steht eine neue Kategorie der Recording Academy, Best Asian Pop Music Performance. Die koreanischen Gruppen sehen sich damit in eine abgetrennte Schublade gestellt, die K-Pop ungerecht von den großen Preisen trennt. „Wir hoffen, dass Musik für das gehört und geliebt wird, was sie ist, und nicht nach Region oder Sprache eingeordnet wird“, sagte BTS damals.",
      "Die Haltung von Stray Kids wiegt besonders schwer, weil alle acht Mitglieder Stimmrecht in der Academy haben. Sie können Nominierte und Gewinner mitentscheiden, obwohl sie aus dem Wettbewerb ausgestiegen sind. Die BBC berichtet, dass dieser gemeinsame Boykott die Glaubwürdigkeit der Preise empfindlich trifft.",
    ],
  },
  it: {
    headline: "Stray Kids: gli architetti del proprio successo nel K-pop",
    history: [
      "Dal debutto ufficiale nel 2018, gli Stray Kids (SKZ) hanno riscritto le regole dell’industria musicale sudcoreana rifiutando la formula dell’idolo prefabbricato. Formati in JYP Entertainment da un duro programma di survival, la loro line-up è stata atipica: Bang Chan, il leader, ha avuto la libertà rara di scegliere di persona i membri che lo avrebbero accompagnato. Quella decisione ha costruito una sinergia e un senso di fratellanza che si sente nelle coreografie e nel modo in cui lavora il team.",
      "La vera pietra angolare dell’identità di SKZ è l’autonomia creativa. Scrittura, composizione e produzione di quasi tutta la loro ampia discografia stanno in 3RACHA, la subunit di produzione di Bang Chan, Changbin e Han. Quel controllo indipendente ha permesso di sperimentare senza i vincoli commerciali di sempre e ha fatto nascere un suono che hanno battezzato loro: “Mala Taste” (sapore piccante).",
      "Il suono si regge su basi di EDM intense, hip-hop pesante e strutture poco convenzionali. Invece di ammorbidire la proposta davanti a chi chiamava le canzoni semplice “rumore”, l’ottetto si è preso il termine noise music. Lo ha trasformato in un’identità riconoscibile e in un motivo di orgoglio, in cima alle classifiche globali con inni ad alto voltaggio come “God's Menu”, “Thunderous”, “Maniac” e “S-Class”.",
      "L’impatto internazionale ha stabilito record storici per la quarta generazione del K-pop. Hanno guidato la Billboard 200 con più album di fila e sono stati headliner di alcuni dei festival più importanti del mondo, a dimostrazione che un approccio audace può parlare a un pubblico molto ampio.",
      "Per STAY, il loro fandom, il richiamo più forte degli Stray Kids sta proprio in quella vulnerabilità e autenticità. Dopo il rinnovo anticipato dei contratti con l’agenzia, gli otto membri hanno assicurato l’espansione del loro universo musicale e promesso ai fan di continuare a spingere i limiti del pop coreano, con la stessa energia, per molti anni ancora.",
    ],
    fact: "Molti fan conoscono il più giovane, I.N, come “Baby Bread”. Un soprannome molto più insolito è “Spoon Worm” (verme cucchiaio) o “Spoon Worm Yang”. È nato alla sua prima lezione con gli altri membri, quando l’insegnante di danza disse che i suoi movimenti erano così traballanti da somigliare a quell’animale. Un altro dato: I.N decise di diventare cantante dopo che alcune persone anziane gli chiesero di cantare trot tradizionale davanti a loro, e quello accese il suo gusto per il palco.",
    news: [
      "In una mossa rara nell’industria musicale, gli Stray Kids hanno annunciato ufficialmente che non presenteranno la loro musica alla 69ª edizione dei Grammy. JYP Entertainment ha confermato la decisione dopo la chiusura delle candidature, lo scorso agosto. Si aggiunge al boicottaggio avviato dai BTS a luglio.",
      "Al centro della protesta c’è la nuova categoria della Recording Academy, Best Asian Pop Music Performance. I gruppi sudcoreani denunciano una corsia separata, che allontana ingiustamente il K-pop dai premi principali. «Speriamo che la musica venga ascoltata e amata per quello che è, invece di essere catalogata per regione o lingua», dichiararono allora i BTS.",
      "La posizione degli Stray Kids pesa ancora di più perché tutti e otto i membri hanno diritto di voto nell’Academy: possono comunque contribuire a scegliere candidati e vincitori pur essendosi ritirati dalla competizione. Secondo la BBC, questo boicottaggio congiunto è un colpo serio alla credibilità dei premi.",
    ],
  },
  pt: {
    headline: "Stray Kids: os arquitetos do seu próprio sucesso no K-pop",
    history: [
      "Desde a estreia oficial em 2018, os Stray Kids (SKZ) reescreveram as regras da indústria musical sul-coreana ao recusar a fórmula do ídolo pré-fabricado. Formados na JYP Entertainment num programa de sobrevivência exigente, a formação foi atípica: Bang Chan, o líder, teve a liberdade rara de escolher pessoalmente os membros que o acompanhariam. Essa decisão cimentou uma sinergia e um sentido de irmandade que se sente nas coreografias e na dinâmica da equipa.",
      "A verdadeira pedra angular da identidade dos SKZ é a autonomia criativa. A composição, a escrita e a produção de quase toda a extensa discografia cabem à 3RACHA, a sub-unit de Bang Chan, Changbin e Han. Esse controlo independente permitiu-lhes experimentar sem as amarras comerciais habituais e deu origem a um som que eles próprios batizaram de “Mala Taste” (sabor picante).",
      "Esse som define-se por bases intensas de EDM, hip-hop pesado e estruturas pouco convencionais. Longe de suavizar a proposta perante quem chamava às canções simples “ruído”, o octeto apropriou-se do termo noise music. Transformou-o numa identidade inconfundível e num motivo de orgulho, no topo das tabelas globais com hinos de alta voltagem como “God's Menu”, “Thunderous”, “Maniac” e “S-Class”.",
      "O impacto internacional estabeleceu recordes históricos para a quarta geração do K-pop. Chegaram várias vezes seguidas ao topo da Billboard 200 e foram cabeças de cartaz de alguns dos festivais mais importantes do mundo, a mostrar que uma abordagem ousada atravessa públicos.",
      "Para os STAY, o seu fandom, o maior atrativo dos Stray Kids está precisamente nessa vulnerabilidade e autenticidade. Depois da renovação antecipada dos contratos com a agência, os oito integrantes garantiram a expansão do seu universo musical e prometeram aos fãs continuar a desafiar os limites do pop coreano, com a mesma energia, durante muitos anos.",
    ],
    fact: "Muitos fãs conhecem a alcunha “Baby Bread” do membro mais novo, I.N. Um dado bem mais invulgar é que lhe chamavam “Spoon Worm” (verme colher) ou “Spoon Worm Yang”. A alcunha surgiu na primeira aula com os outros membros, quando o professor de dança disse que os movimentos dele eram tão bamboleantes que pareciam esse animal. Outro pormenor: I.N decidiu ser cantor depois de um grupo de pessoas mais velhas lhe pedir que cantasse trot tradicional à frente delas, o que despertou o gosto pelos palcos.",
    news: [
      "Num gesto raro na indústria musical, os Stray Kids anunciaram oficialmente que não vão submeter a sua música à 69.ª edição dos Grammy. A JYP Entertainment confirmou a decisão depois do fecho do prazo de submissão, em agosto passado. Junta-se ao boicote iniciado pelos BTS em julho.",
      "No centro do protesto está a nova categoria da Recording Academy, Best Asian Pop Music Performance. Os grupos sul-coreanos denunciam uma categoria à parte, que separa injustamente o K-pop dos prémios principais. «Esperamos que a música seja ouvida e amada pelo que é, em vez de ser categorizada por região ou idioma», declararam os BTS na altura.",
      "A posição dos Stray Kids é especialmente forte porque os oito membros têm direito de voto na Academy e podem ajudar a decidir nomeados e vencedores mesmo depois de saírem da competição. Segundo a BBC, este boicote conjunto é um golpe sério na credibilidade dos prémios.",
    ],
  },
  id: {
    headline: "Stray Kids: arsitek kesuksesan mereka sendiri di K-pop",
    history: [
      "Sejak debut resmi pada 2018, Stray Kids (SKZ) menulis ulang aturan industri musik Korea Selatan dengan menolak rumus idola yang sudah jadi. Dibentuk di JYP Entertainment lewat program survival yang ketat, formasi mereka tidak biasa: Bang Chan, pemimpin grup, mendapat kebebasan langka untuk memilih sendiri anggota yang akan bersamanya. Keputusan itu membangun sinergi dan rasa persaudaraan yang terasa di koreografi maupun di cara tim bekerja.",
      "Batu penjuru identitas SKZ adalah otonomi kreatif. Penulisan, komposisi, dan produksi hampir seluruh diskografi mereka yang luas ada di tangan 3RACHA, subunit produser Bang Chan, Changbin, dan Han. Kontrol yang mandiri itu membuat mereka bisa bereksperimen tanpa ikatan komersial yang biasa, dan melahirkan suara yang mereka namai sendiri: “Mala Taste” (rasa pedas).",
      "Suara itu berdiri di atas EDM yang intens, hip-hop yang berat, dan struktur yang tidak konvensional. Alih-alih melunakkan musik bagi orang yang menyebutnya sekadar “noise”, kedelapan anggota mengambil istilah noise music. Mereka mengubahnya menjadi identitas yang khas dan kebanggaan, lalu menduduki tangga lagu global dengan himne bertegangan tinggi seperti “God's Menu”, “Thunderous”, “Maniac”, dan “S-Class”.",
      "Dampak internasionalnya mencatat rekor historis untuk generasi keempat K-pop. Mereka memuncaki Billboard 200 dengan beberapa album berturut-turut dan menjadi headliner di beberapa festival terbesar di dunia, bukti bahwa pendekatan yang berani bisa menyeberang ke banyak pendengar.",
      "Bagi STAY, fandom mereka, daya tarik terbesar Stray Kids justru ada pada kerentanan dan keaslian itu. Setelah memperbarui kontrak dengan agensi lebih awal, kedelapan anggota mengamankan ruang untuk memperluas semesta musik mereka, dan berjanji pada penggemar akan terus mendorong batas pop Korea dengan energi yang sama selama bertahun-tahun.",
    ],
    fact: "Banyak fans mengenal anggota termuda, I.N, sebagai “Baby Bread”. Julukan yang jauh lebih aneh adalah “Spoon Worm” atau “Spoon Worm Yang”. Julukan itu muncul di kelas pertamanya bersama anggota lain, ketika guru tari berkata gerakannya begitu goyah sampai mirip hewan itu. Satu lagi: I.N memutuskan menjadi penyanyi setelah sekelompok orang yang lebih tua memintanya menyanyikan trot tradisional di depan mereka, dan itu membangunkan rasa sukanya pada panggung.",
    news: [
      "Dalam langkah yang jarang di industri musik, Stray Kids resmi mengumumkan bahwa mereka tidak akan mengajukan musiknya untuk Grammy Awards ke-69. JYP Entertainment mengonfirmasi keputusan itu setelah batas pengajuan ditutup Agustus lalu. Langkah ini bergabung dengan boikot yang dimulai BTS pada Juli.",
      "Inti protes adalah kategori baru dari Recording Academy, Best Asian Pop Music Performance. Grup Korea menilai kategori itu menempatkan mereka di jalur yang terpisah dan memisahkan K-pop dari penghargaan utama secara tidak adil. “Kami berharap musik didengar dan dicintai karena apa adanya, bukan dikategorikan menurut wilayah atau bahasa,” ujar BTS saat itu.",
      "Sikap Stray Kids semakin tegas karena kedelapan anggota memiliki hak suara di Academy, jadi mereka tetap bisa ikut menentukan nominasi dan pemenang meski mundur dari kompetisi. BBC melaporkan boikot bersama ini merupakan pukulan serius bagi kredibilitas penghargaan tersebut.",
    ],
  },
  th: {
    headline: "Stray Kids: สถาปนิกความสำเร็จของตัวเองในเคป็อป",
    history: [
      "ตั้งแต่เดบิวต์อย่างเป็นทางการในปี 2018 Stray Kids (SKZ) เขียนกฎของอุตสาหกรรมเพลงเกาหลีใต้ใหม่ ด้วยการไม่รับสูตรไอดอลสำเร็จรูป พวกเขาถูกหล่อหลอมที่ JYP Entertainment ผ่านรายการเอาชีวิตรอดที่หนัก และรูปแบบวงก็ไม่ธรรมดา: บังชาน หัวหน้าวง ได้อิสระที่หาได้ยากในการเลือกสมาชิกที่จะอยู่ด้วยกัน การตัดสินใจนั้นวางรากของจังหวะที่เข้ากันและความรู้สึกแบบพี่น้อง ซึ่งเห็นได้ทั้งในท่าเต้นและในวิธีที่ทีมทำงาน",
      "เสาหลักที่แท้จริงของตัวตน SKZ คืออิสระในการสร้างสรรค์ การเขียน แต่ง และโปรดิวซ์ผลงานเกือบทั้งหมดอยู่ในมือ 3RACHA ยูนิตโปรดิวเซอร์ของบังชาน ชางบิน และฮัน การควบคุมแบบอิสระนี้ทำให้พวกเขาทดลองได้โดยไม่ถูกกรอบการค้าแบบเดิม และให้กำเนิดเสียงที่พวกเขาตั้งชื่อเองว่า “Mala Taste” (รสเผ็ด)",
      "เสียงนั้นตั้งอยู่บน EDM ที่เข้ม ฮิปฮอปที่หนัก และโครงสร้างที่ไม่ตามแบบ แทนที่จะทำให้เพลงนุ่มลงเพราะมีคนเรียกว่าเป็นเพียง “นอยส์” ทั้งแปดคนหยิบคำว่า noise music มาเป็นของตัวเอง พวกเขาเปลี่ยนมันเป็นเอกลักษณ์และความภาคภูมิ แล้วขึ้นชาร์ตโลกด้วยเพลงพลังสูงอย่าง “God's Menu”, “Thunderous”, “Maniac” และ “S-Class”",
      "แรงกระเพื่อมระดับนานาชาติสร้างสถิติให้เจนเนอเรชันที่สี่ของเคป็อป พวกเขาขึ้นอันดับหนึ่ง Billboard 200 ด้วยหลายอัลบั้มติดต่อกัน และเป็นเฮดไลเนอร์เทศกาลใหญ่ของโลก แสดงให้เห็นว่าทางที่กล้าหาญไปได้ไกลกว่าผู้ฟังกลุ่มเดียว",
      "สำหรับ STAY แฟนด้อมของพวกเขา สิ่งที่ดึงดูดที่สุดของ Stray Kids คือความเปราะบางและความจริงใจนั้นเอง หลังต่อสัญญากับค่ายก่อนกำหนด สมาชิกทั้งแปดได้พื้นที่ขยายจักรวาลเพลงของตัวเอง และสัญญากับแฟนว่าจะผลักขอบของป็อปเกาหลีต่อไปด้วยพลังเดิมไปอีกหลายปี",
    ],
    fact: "แฟนหลายคนรู้จักสมาชิกอายุน้อยสุด I.N ในชื่อ “Baby Bread” ชื่อเล่นที่แปลกกว่านั้นมากคือ “Spoon Worm” หรือ “Spoon Worm Yang” มันเกิดในคลาสแรกกับสมาชิกคนอื่น เมื่อครูเต้นบอกว่าท่าของเขาโซเซจนเหมือนสัตว์ตัวนั้น อีกเรื่อง: I.N ตัดสินใจเป็นนักร้องหลังจากผู้สูงวัยกลุ่มหนึ่งขอให้เขาร้องเพลงทรอตดั้งเดิมต่อหน้าพวกเขา ซึ่งปลุกความชอบเวทีขึ้นมา",
    news: [
      "ในการเคลื่อนไหวที่หาได้ยากในอุตสาหกรรมเพลง Stray Kids ประกาศอย่างเป็นทางการว่าจะไม่ส่งเพลงเข้าชิง Grammy ครั้งที่ 69 JYP Entertainment ยืนยันการตัดสินใจหลังปิดรับผลงานเมื่อสิงหาคมที่ผ่านมา และเข้าร่วมกับบอยคอตที่ BTS เริ่มในเดือนกรกฎาคม",
      "ใจกลางการประท้วงคือหมวดใหม่ของ Recording Academy ชื่อ Best Asian Pop Music Performance วงเกาหลีมองว่ามันผลักพวกเขาไปช่องที่แยกออก และแยกเคป็อปออกจากรางวัลหลักอย่างไม่เป็นธรรม “เราหวังว่าเพลงจะถูกฟังและถูกรักในสิ่งที่มันเป็น ไม่ใช่ถูกจัดตามภูมิภาคหรือภาษา” BTS กล่าวไว้ตอนนั้น",
      "ท่าทีของ Stray Kids หนักเป็นพิเศษเพราะสมาชิกทั้งแปดมีสิทธิ์โหวตใน Academy จึงยังช่วยตัดสินผู้เข้าชิงและผู้ชนะได้ แม้จะถอนตัวจากการแข่งขัน BBC รายงานว่าบอยคอตร่วมครั้งนี้เป็นแรงกระแทกต่อความน่าเชื่อถือของรางวัล",
    ],
  },
  ja: {
    headline: "Stray Kids：K-Popで、自分たちの成功を設計した人たち",
    history: [
      "2018年の正式デビュー以来、Stray Kids（SKZ）は、できあいのアイドルという型を拒むことで、韓国の音楽産業のルールを書き換えてきました。JYPエンターテインメントの厳しいサバイバル番組で形づくられ、その結成は典型的ではありません。リーダーのバンチャンには、一緒に進むメンバーを自分で選ぶ、めったにない自由がありました。その決断が、振り付けにもチームの動き方にもにじむ一体感と、兄弟のような感覚を作りました。",
      "SKZの核は、創作の自主性です。膨大なディスコグラフィのほとんどを、作詞、作曲、プロデュースしているのは、バンチャン、チャンビン、ハンによるプロデュースユニット 3RACHA です。その独立した主導権のおかげで、彼らはいつもの商業的な縛りなしに実験でき、自分たちで「Mala Taste」（辛い味）と名付けた音を生みました。",
      "その音は、強いEDM、重いヒップホップ、型にはまらない構成でできています。曲を単なる「ノイズ」と呼ぶ声に合わせて角を落とす代わりに、8人は noise music という言葉を自分たちのものにしました。それは紛れもない個性と誇りの印になり、「God's Menu」「Thunderous」「Maniac」「S-Class」のような高電圧のアンセムで世界のチャートを取りました。",
      "その国際的な広がりは、第4世代のK-Popとして歴史的な記録を作っています。Billboard 200 を複数のアルバムで連続して首位にし、世界有数のフェスティバルでヘッドライナーを務め、大胆なやり方が一つの聴き手を越えて届くことを示しました。",
      "STAYにとって、Stray Kidsの一番の引力は、まさにその脆さと本物らしさです。事務所との契約を前倒しで更新したあと、8人は音楽の世界を広げ続ける場所を確保し、これからも同じエネルギーで韓国のポップの境界を押し続けると、ファンに約束しています。",
    ],
    fact: "一番年下の I.N の愛称「Baby Bread」は、多くのファンが知っています。もっと珍しいのは「Spoon Worm」、または「Spoon Worm Yang」です。他のメンバーとの最初のレッスンで、ダンスの先生が、動きがふらふらしてその生き物みたいだと言ったことから付きました。もう一つ。年上の人たちに、目の前で伝統的なトロットを歌ってほしいと頼まれたことが、I.N が歌手になると決めたきっかけで、ステージへの気持ちがそこから目を覚ましました。",
    news: [
      "音楽業界ではほとんど例のない動きとして、Stray Kids は第69回グラミー賞に楽曲を提出しないと正式に発表しました。応募期限が昨8月に閉じたあと、JYPエンターテインメントが決定を確認しています。これは、昨年7月に BTS が始めたボイコットに加わるものです。",
      "抗議の中心は、レコーディング・アカデミーが新設した Best Asian Pop Music Performance です。韓国のグループは、これが自分たちを分けられた枠に置き、K-Popを主要な賞から不当に切り離すものだと批判しています。「音楽が、地域や言語で分類されるのではなく、そのものとして聴かれ、愛されることを願います」と、当時 BTS は述べました。",
      "Stray Kids の姿勢がとりわけ重いのは、8人全員がアカデミーの投票権を持っているからです。競争からは降りても、ノミネートと受賞者を決める側には残ります。BBC は、この共同ボイコットが賞の信頼性への厳しい打撃だと伝えています。",
    ],
  },
  ko: {
    headline: "Stray Kids: K-pop에서 자기 성공을 설계한 사람들",
    history: [
      "2018년 정식 데뷔 이후 Stray Kids(SKZ)는 미리 만들어진 아이돌 공식을 거부하며 한국 음악 산업의 규칙을 다시 썼습니다. JYP 엔터테인먼트의 혹독한 서바이벌 프로그램에서 만들어졌고, 그 결성은 전형적이지 않았습니다. 리더 방찬은 함께할 멤버를 직접 고르는, 드문 자유를 받았습니다. 그 결정은 안무에서도, 팀이 움직이는 방식에서도 느껴지는 호흡과 형제 같은 감각을 만들었습니다.",
      "SKZ 정체성의 진짜 주춧돌은 창작의 자율성입니다. 방대한 디스코그래피의 거의 전부를 작사, 작곡, 프로듀싱하는 사람은 방찬, 창빈, 한으로 이루어진 프로듀싱 유닛 3RACHA입니다. 그 독립적인 주도권 덕분에 그들은 익숙한 상업적 굴레 없이 실험할 수 있었고, 스스로 “Mala Taste”(매운 맛)라고 이름 붙인 소리를 만들었습니다.",
      "그 소리는 강한 EDM, 무거운 힙합, 관습에 안 맞는 구조 위에 있습니다. 곡을 단순한 “노이즈”라고 부르는 시선에 맞춰 날을 죽이는 대신, 여덟 명은 noise music이라는 말을 자기 것으로 가져왔습니다. 그것은 한눈에 알아보는 정체성과 자부심이 되었고, “God's Menu”, “Thunderous”, “Maniac”, “S-Class” 같은 고전압 곡으로 세계 차트를 올랐습니다.",
      "그 국제적인 파급은 4세대 K-pop의 역사적인 기록을 세웠습니다. 여러 앨범을 연달아 Billboard 200 정상에 올렸고, 세계적인 페스티벌의 헤드라이너를 맡으며, 대담한 방식이 한 청중을 넘어 닿는다는 것을 보여 주었습니다.",
      "STAY에게 Stray Kids의 가장 큰 끌림은 바로 그 취약함과 진정성입니다. 소속사와 계약을 앞당겨 갱신한 뒤, 여덟 멤버는 음악 세계를 계속 넓힐 자리를 확보했고, 앞으로도 같은 에너지로 한국 팝의 경계를 밀어 가겠다고 팬에게 약속했습니다.",
    ],
    fact: "많은 팬이 막내 I.N의 별명 “Baby Bread”를 압니다. 훨씬 특이한 별명은 “Spoon Worm”, 또는 “Spoon Worm Yang”입니다. 다른 멤버들과의 첫 수업에서 댄스 선생님이 동작이 너무 휘청거려 그 동물 같다고 말한 데서 붙었습니다. 하나 더. I.N이 가수가 되기로 한 것은, 연세 드신 분들이 앞에서 전통 트로트를 불러 달라고 한 뒤였고, 그 일이 무대에 대한 마음을 깨웠습니다.",
    news: [
      "음악 산업에서 거의 선례가 없는 움직임으로, Stray Kids는 제69회 그래미 어워드에 음악을 제출하지 않겠다고 공식 발표했습니다. 지난 8월 제출 마감이 끝난 뒤 JYP 엔터테인먼트가 결정을 확인했습니다. 이는 지난 7월 BTS가 시작한 보이콧에 합류하는 것입니다.",
      "항의의 중심은 레코딩 아카데미가 새로 만든 Best Asian Pop Music Performance입니다. 한국 그룹들은 이 범주가 자신들을 분리된 칸에 두고, K-pop을 주요 시상과 부당하게 떨어뜨린다고 봅니다. “음악이 지역이나 언어로 분류되기보다, 그 자체로 들리고 사랑받기를 바랍니다.” 당시 BTS가 한 말입니다.",
      "Stray Kids의 입장이 특히 무거운 이유는 여덟 멤버 모두가 아카데미 투표권을 가지고 있기 때문입니다. 경쟁에서는 빠졌어도 후보와 수상자를 정하는 쪽에는 남을 수 있습니다. BBC는 이 공동 보이콧이 시상의 신뢰성에 심한 타격이라고 전했습니다.",
    ],
  },
  zh: {
    headline: "Stray Kids：在 K-pop 里为自己的成功做架构的人",
    history: [
      "自 2018 年正式出道以来，Stray Kids（SKZ）拒绝现成的偶像公式，改写了韩国音乐产业的规则。他们在 JYP Entertainment 经过严苛的生存节目成形，组合方式并不典型：队长方灿得到了极少见的自由，亲自挑选将与自己同行的成员。这个决定打下了一种默契和兄弟般的感觉，编舞里能看见，团队相处的方式里也能看见。",
      "SKZ 身份真正的基石，是创作上的自主。几乎全部庞大作品的词、曲和制作，都落在 3RACHA 身上。这是方灿、彰彬和韩组成的制作小队。这种独立的掌控让他们可以不受惯常商业框架的束缚去试验，并生出一种他们自己命名的声音：“Mala Taste”（辣味）。",
      "这种声音建立在强烈的 EDM、厚重的嘻哈和不按常规的结构上。面对把他们的歌称为单纯“噪音”的声音，八个人没有把音乐磨软，而是把 noise music 这个词拿了过来。它变成一种认得出的身份，也变成一种骄傲，并靠《God's Menu》《Thunderous》《Maniac》《S-Class》这样的高电压作品登上全球榜单。",
      "这种做法的国际影响，为第四代 K-pop 写下了历史纪录。他们以多张专辑连续登上 Billboard 200 榜首，也作为头牌站上世界上一些最重要的音乐节，说明大胆的路可以穿过不止一种听众。",
      "对 STAY 来说，Stray Kids 最大的吸引力，正是这种脆弱和真实。提前与公司续约之后，八名成员保住了继续扩展音乐世界的空间，并向粉丝承诺，还会用同样停不下来的能量，在很多年里继续推动韩国流行的边界。",
    ],
    fact: "很多粉丝知道最小的成员 I.N 的外号是 “Baby Bread”。更少见的外号是 “Spoon Worm”，或者 “Spoon Worm Yang”。它出现在他和其他成员的第一堂课上，舞蹈老师说他的动作晃得厉害，像那种动物。还有一件事：几位年长的人请 I.N 当着他们的面唱传统 trot，之后他决定成为歌手，对舞台的喜欢就是那时被叫醒的。",
    news: [
      "在音乐产业里几乎没有先例的一步里，Stray Kids 正式宣布，不会把音乐提交给第 69 届格莱美。去年八月提交截止日期结束后，JYP Entertainment 确认了这个决定。它加入了 BTS 在去年七月开始的抵制。",
      "抗议的核心，是录音学院新设的 Best Asian Pop Music Performance。韩国组合认为，这把他们放进一个被隔开的类别，不公平地把 K-pop 和主要奖项分开。“我们希望音乐因其本身被听见、被爱，而不是按地区或语言被归类。”BTS 当时这样说。",
      "Stray Kids 的立场尤其有分量，因为八名成员都拥有学院的投票权。即使退出竞争，他们仍然可以参与决定提名和获奖者。BBC 报道，这次共同抵制对奖项的公信力是一次沉重打击。",
    ],
  },
};

export function aboutCopy(language: string | null | undefined): AboutCopy {
  return about[editorialLang(language)];
}

export function artistCopy(language: string | null | undefined): ArtistCopy {
  return artist[editorialLang(language)];
}
