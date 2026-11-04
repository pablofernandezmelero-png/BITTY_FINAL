// Preguntas ampliadas de Bitty. SIN nodos, rutas, niveles ni categorías nuevas: solo se añaden
// preguntas a los bancos que ya existen (cmp, hw, bin, os, net, web, alg, ds, db, sec, git, ai, pro,
// py, pye, js, jse, jv, jve).
//
// Formato: q(banco, dificultad, [es], [en], [nl], run?)
//   dificultad: 0 fácil · 1 normal · 2 difícil
//   cada idioma: [enunciado, RESPUESTA CORRECTA, mala1, mala2, mala3]   (la app mezcla las opciones)
//   run (opcional): { lang: "py" | "js", code } -> el enunciado lleva {code} y el test EJECUTA el código
//                   y comprueba que la respuesta correcta es exactamente lo que imprime.
// El texto va SIN html (la herramienta de generación escapa < > &). Solo se permite <br> en el enunciado.
//
// Regenerar el bloque del HTML:  node tools/build-questions.js
const Q = [];
const q = (b, t, es, en, nl, run) => Q.push({ b, t, es, en, nl, run });
const CODE_ES = "¿Qué muestra este código?<br>{code}";
const CODE_EN = "What does this code print?<br>{code}";
const CODE_NL = "Wat toont deze code?<br>{code}";

// ================= cmp · Informática básica =================
q("cmp", 0, ["¿Qué unidad mide la velocidad de reloj de una CPU?", "GHz (gigahercios)", "GB (gigabytes)", "Mbps (megabits por segundo)", "dpi (puntos por pulgada)"],
  ["Which unit measures the clock speed of a CPU?", "GHz (gigahertz)", "GB (gigabytes)", "Mbps (megabits per second)", "dpi (dots per inch)"],
  ["Welke eenheid meet de kloksnelheid van een cpu?", "GHz (gigahertz)", "GB (gigabyte)", "Mbps (megabit per seconde)", "dpi (punten per inch)"]);
q("cmp", 0, ["El software es…", "El conjunto de programas e instrucciones de un computador", "Las piezas físicas que se pueden tocar", "El cable de red", "La carcasa del equipo"],
  ["Software is…", "The set of programs and instructions of a computer", "The physical parts you can touch", "The network cable", "The case of the machine"],
  ["Software is…", "De verzameling programma's en instructies van een computer", "De fysieke onderdelen die je kunt aanraken", "De netwerkkabel", "De behuizing van het apparaat"]);
q("cmp", 1, ["¿Qué diferencia hay entre la RAM y el almacenamiento?", "La RAM es rápida y temporal; el almacenamiento guarda los datos de forma permanente", "La RAM guarda tus archivos para siempre", "Son exactamente lo mismo", "El almacenamiento solo existe en los móviles"],
  ["What is the difference between RAM and storage?", "RAM is fast and temporary; storage keeps data permanently", "RAM keeps your files forever", "They are exactly the same", "Storage only exists on phones"],
  ["Wat is het verschil tussen RAM en opslag?", "RAM is snel en tijdelijk; opslag bewaart gegevens blijvend", "RAM bewaart je bestanden voor altijd", "Ze zijn precies hetzelfde", "Opslag bestaat alleen op telefoons"]);
q("cmp", 1, ["¿Qué es la computación en la nube (cloud)?", "Usar servidores remotos por internet para guardar o procesar datos", "Un tipo de procesador muy rápido", "Un programa de dibujo", "Una red de cables dentro del equipo"],
  ["What is cloud computing?", "Using remote servers over the internet to store or process data", "A very fast type of processor", "A drawing program", "A network of cables inside the machine"],
  ["Wat is cloud computing?", "Externe servers via internet gebruiken om gegevens op te slaan of te verwerken", "Een heel snel type processor", "Een tekenprogramma", "Een netwerk van kabels in het apparaat"]);
q("cmp", 2, ["En la arquitectura de von Neumann, ¿dónde se guardan los datos y las instrucciones?", "En la misma memoria", "En dos memorias totalmente separadas", "Solo dentro de la CPU", "Solo en el disco duro"],
  ["In the von Neumann architecture, where are data and instructions stored?", "In the same memory", "In two completely separate memories", "Only inside the CPU", "Only on the hard drive"],
  ["Waar worden gegevens en instructies opgeslagen in de von Neumann-architectuur?", "In hetzelfde geheugen", "In twee volledig gescheiden geheugens", "Alleen in de cpu", "Alleen op de harde schijf"]);
q("cmp", 2, ["¿Para qué sirve la memoria caché de la CPU?", "Guarda copias de datos usados a menudo para acceder a ellos más rápido", "Almacena tus archivos de forma permanente", "Enfría el procesador", "Conecta el equipo a internet"],
  ["What is the CPU cache for?", "It keeps copies of frequently used data for faster access", "It stores your files permanently", "It cools the processor", "It connects the machine to the internet"],
  ["Waar dient het cachegeheugen van de cpu voor?", "Het bewaart kopieën van veelgebruikte gegevens voor snellere toegang", "Het slaat je bestanden blijvend op", "Het koelt de processor", "Het verbindt het apparaat met internet"]);

// ================= hw · Hardware =================
q("hw", 0, ["¿Para qué sirve la placa base?", "Conecta y comunica todos los componentes del equipo", "Solo guarda los archivos", "Solo muestra la imagen", "Solo enfría la CPU"],
  ["What is the motherboard for?", "It connects and lets all the components communicate", "It only stores files", "It only shows the image", "It only cools the CPU"],
  ["Waar dient het moederbord voor?", "Het verbindt alle onderdelen en laat ze met elkaar communiceren", "Het slaat alleen bestanden op", "Het toont alleen het beeld", "Het koelt alleen de cpu"]);
q("hw", 0, ["¿Qué componente se encarga sobre todo de procesar los gráficos?", "La GPU", "La fuente de alimentación", "El teclado", "El ratón"],
  ["Which component mainly handles graphics processing?", "The GPU", "The power supply", "The keyboard", "The mouse"],
  ["Welk onderdeel verwerkt vooral grafische beelden?", "De gpu", "De voeding", "Het toetsenbord", "De muis"]);
q("hw", 1, ["Comparado con un disco duro clásico (HDD), un SSD…", "No tiene piezas móviles y suele ser más rápido", "Tiene un plato que gira", "Siempre es más lento", "Funciona sin electricidad"],
  ["Compared with a classic hard drive (HDD), an SSD…", "Has no moving parts and is usually faster", "Has a spinning platter", "Is always slower", "Works without electricity"],
  ["Vergeleken met een klassieke harde schijf (HDD) heeft een SSD…", "Geen bewegende delen en is meestal sneller", "Een draaiende schijf", "Altijd een lagere snelheid", "Geen stroom nodig"]);
q("hw", 1, ["¿Qué hace la fuente de alimentación?", "Convierte la corriente de la pared en la que usan los componentes", "Guarda los datos", "Procesa las imágenes", "Conecta con el wifi"],
  ["What does the power supply do?", "It converts mains power into what the components use", "It stores data", "It processes images", "It connects to wifi"],
  ["Wat doet de voeding?", "Ze zet de stroom uit het stopcontact om in wat de onderdelen gebruiken", "Ze slaat gegevens op", "Ze verwerkt beelden", "Ze maakt verbinding met wifi"]);
q("hw", 1, ["¿Qué tipo de memoria pierde su contenido al apagar el equipo?", "La RAM", "Un SSD", "Un disco duro (HDD)", "Una memoria USB"],
  ["Which type of memory loses its content when the machine is turned off?", "RAM", "An SSD", "A hard drive (HDD)", "A USB stick"],
  ["Welk type geheugen verliest zijn inhoud als het apparaat uitgaat?", "RAM", "Een SSD", "Een harde schijf (HDD)", "Een USB-stick"]);
q("hw", 2, ["¿Qué significa que un procesador tenga 8 núcleos?", "Puede ejecutar varias tareas a la vez, una en cada núcleo", "Tiene 8 veces más memoria RAM", "Funciona a 8 GHz", "Tiene 8 puertos USB"],
  ["What does it mean for a processor to have 8 cores?", "It can run several tasks at once, one per core", "It has 8 times more RAM", "It runs at 8 GHz", "It has 8 USB ports"],
  ["Wat betekent het als een processor 8 kernen heeft?", "Hij kan meerdere taken tegelijk uitvoeren, één per kern", "Hij heeft 8 keer meer RAM", "Hij draait op 8 GHz", "Hij heeft 8 USB-poorten"]);

// ================= bin · Binario y datos =================
q("bin", 0, ["¿Qué dígitos usa el sistema binario?", "0 y 1", "Del 0 al 9", "1 y 2", "Del 0 al 7"],
  ["Which digits does the binary system use?", "0 and 1", "0 to 9", "1 and 2", "0 to 7"],
  ["Welke cijfers gebruikt het binaire stelsel?", "0 en 1", "0 tot en met 9", "1 en 2", "0 tot en met 7"]);
q("bin", 0, ["¿Cuál es la unidad más pequeña de información en un computador?", "El bit", "El byte", "El megabyte", "El píxel"],
  ["What is the smallest unit of information in a computer?", "The bit", "The byte", "The megabyte", "The pixel"],
  ["Wat is de kleinste eenheid van informatie in een computer?", "De bit", "De byte", "De megabyte", "De pixel"]);
q("bin", 1, ["¿Cuánto vale 101 en binario, escrito en decimal?", "5", "3", "6", "7"],
  ["What is binary 101 in decimal?", "5", "3", "6", "7"],
  ["Hoeveel is binair 101 in decimale notatie?", "5", "3", "6", "7"]);
q("bin", 1, ["¿Cómo se escribe el número 6 en binario?", "110", "101", "011", "111"],
  ["How do you write the number 6 in binary?", "110", "101", "011", "111"],
  ["Hoe schrijf je het getal 6 binair?", "110", "101", "011", "111"]);
q("bin", 2, ["¿Cuánto vale 11111111 en binario, escrito en decimal?", "255", "256", "127", "128"],
  ["What is binary 11111111 in decimal?", "255", "256", "127", "128"],
  ["Hoeveel is binair 11111111 in decimale notatie?", "255", "256", "127", "128"]);
q("bin", 2, ["¿Cuánto es 1011 + 0110 en binario?", "10001", "10011", "1111", "10101"],
  ["What is 1011 + 0110 in binary?", "10001", "10011", "1111", "10101"],
  ["Hoeveel is 1011 + 0110 binair?", "10001", "10011", "1111", "10101"]);
q("bin", 2, ["¿Qué valor decimal tiene el número hexadecimal 1F?", "31", "15", "16", "47"],
  ["What is the decimal value of the hexadecimal number 1F?", "31", "15", "16", "47"],
  ["Wat is de decimale waarde van het hexadecimale getal 1F?", "31", "15", "16", "47"]);

// ================= os · Sistemas operativos =================
q("os", 0, ["¿Para qué sirve el administrador de tareas?", "Para ver y cerrar los programas y procesos en ejecución", "Para dibujar", "Para navegar por internet", "Para escribir cartas"],
  ["What is the task manager for?", "To see and close the programs and processes that are running", "To draw", "To browse the internet", "To write letters"],
  ["Waar dient taakbeheer voor?", "Om de draaiende programma's en processen te bekijken en af te sluiten", "Om te tekenen", "Om op internet te surfen", "Om brieven te schrijven"]);
q("os", 1, ["¿Qué es el kernel de un sistema operativo?", "El núcleo que gestiona la CPU, la memoria y los dispositivos", "Un tipo de virus", "Una aplicación de mensajería", "Un navegador web"],
  ["What is the kernel of an operating system?", "The core that manages the CPU, memory and devices", "A type of virus", "A messaging app", "A web browser"],
  ["Wat is de kernel van een besturingssysteem?", "De kern die de cpu, het geheugen en de apparaten beheert", "Een type virus", "Een berichtenapp", "Een webbrowser"]);
q("os", 1, ["¿Qué es un proceso?", "Un programa en ejecución", "Un archivo guardado en el disco", "Un cable", "Una contraseña"],
  ["What is a process?", "A program that is running", "A file stored on the disk", "A cable", "A password"],
  ["Wat is een proces?", "Een programma dat draait", "Een bestand op de schijf", "Een kabel", "Een wachtwoord"]);
q("os", 1, ["En Linux, ¿qué hace el comando ls?", "Lista el contenido de un directorio", "Borra archivos", "Cambia de usuario", "Apaga el equipo"],
  ["In Linux, what does the ls command do?", "It lists the contents of a directory", "It deletes files", "It switches user", "It shuts the machine down"],
  ["Wat doet het commando ls in Linux?", "Het toont de inhoud van een map", "Het verwijdert bestanden", "Het wisselt van gebruiker", "Het zet het apparaat uit"]);
q("os", 2, ["Si la RAM se llena y el sistema usa el disco como memoria extra, ¿cómo se llama esa técnica?", "Memoria virtual (swap)", "Overclocking", "Formateo", "Cifrado"],
  ["If RAM fills up and the system uses the disk as extra memory, what is this technique called?", "Virtual memory (swap)", "Overclocking", "Formatting", "Encryption"],
  ["Hoe heet de techniek waarbij het systeem de schijf als extra geheugen gebruikt als het RAM vol zit?", "Virtueel geheugen (swap)", "Overklokken", "Formatteren", "Versleuteling"]);
q("os", 2, ["¿Qué hace un planificador (scheduler) del sistema operativo?", "Decide qué proceso usa la CPU y durante cuánto tiempo", "Programa las copias de seguridad", "Instala los programas", "Conecta a la red wifi"],
  ["What does an operating system scheduler do?", "It decides which process uses the CPU and for how long", "It schedules backups", "It installs programs", "It connects to the wifi network"],
  ["Wat doet de scheduler van een besturingssysteem?", "Hij bepaalt welk proces de cpu gebruikt en hoe lang", "Hij plant back-ups in", "Hij installeert programma's", "Hij maakt verbinding met het wifi-netwerk"]);

// ================= net · Redes =================
q("net", 0, ["¿Qué es una dirección IP?", "Un identificador de un dispositivo dentro de una red", "Una contraseña", "Un tipo de cable", "Un programa"],
  ["What is an IP address?", "An identifier of a device on a network", "A password", "A type of cable", "A program"],
  ["Wat is een IP-adres?", "Een identificatie van een apparaat in een netwerk", "Een wachtwoord", "Een type kabel", "Een programma"]);
q("net", 0, ["¿Qué es el wifi?", "Una tecnología para conectarse a una red sin cables", "Un tipo de pantalla", "Un virus", "Un cable de fibra"],
  ["What is wifi?", "A technology to connect to a network without cables", "A type of screen", "A virus", "A fibre cable"],
  ["Wat is wifi?", "Een technologie om zonder kabels met een netwerk te verbinden", "Een type scherm", "Een virus", "Een glasvezelkabel"]);
q("net", 1, ["¿Qué hace un router?", "Dirige los paquetes de datos entre redes", "Guarda las páginas web", "Imprime documentos", "Cifra el disco duro"],
  ["What does a router do?", "It directs data packets between networks", "It stores web pages", "It prints documents", "It encrypts the hard drive"],
  ["Wat doet een router?", "Hij stuurt datapakketten tussen netwerken door", "Hij slaat webpagina's op", "Hij print documenten", "Hij versleutelt de harde schijf"]);
q("net", 1, ["¿Qué protocolo carga las páginas web de forma segura (cifrada)?", "HTTPS", "FTP", "SMTP", "POP3"],
  ["Which protocol loads web pages securely (encrypted)?", "HTTPS", "FTP", "SMTP", "POP3"],
  ["Welk protocol laadt webpagina's veilig (versleuteld)?", "HTTPS", "FTP", "SMTP", "POP3"]);
q("net", 2, ["¿Para qué sirve el DNS?", "Para traducir nombres de dominio a direcciones IP", "Para cifrar contraseñas", "Para repartir la señal wifi", "Para comprimir imágenes"],
  ["What is DNS for?", "To translate domain names into IP addresses", "To encrypt passwords", "To spread the wifi signal", "To compress images"],
  ["Waar dient DNS voor?", "Om domeinnamen om te zetten naar IP-adressen", "Om wachtwoorden te versleutelen", "Om het wifi-signaal te verspreiden", "Om afbeeldingen te comprimeren"]);
q("net", 2, ["¿Cuál es la diferencia principal entre TCP y UDP?", "TCP garantiza la entrega ordenada; UDP es más rápido pero sin garantías", "UDP siempre cifra los datos", "TCP solo funciona por wifi", "Son idénticos"],
  ["What is the main difference between TCP and UDP?", "TCP guarantees ordered delivery; UDP is faster but has no guarantees", "UDP always encrypts the data", "TCP only works over wifi", "They are identical"],
  ["Wat is het belangrijkste verschil tussen TCP en UDP?", "TCP garandeert geordende aflevering; UDP is sneller maar zonder garanties", "UDP versleutelt de gegevens altijd", "TCP werkt alleen via wifi", "Ze zijn identiek"]);

// ================= web · Web =================
q("web", 0, ["¿Qué lenguaje da estructura al contenido de una página web?", "HTML", "CSS", "SQL", "Bash"],
  ["Which language gives structure to the content of a web page?", "HTML", "CSS", "SQL", "Bash"],
  ["Welke taal geeft structuur aan de inhoud van een webpagina?", "HTML", "CSS", "SQL", "Bash"]);
q("web", 0, ["¿Qué lenguaje se usa para dar estilo (colores, tamaños, márgenes) a una web?", "CSS", "HTML", "SQL", "JSON"],
  ["Which language is used to style a web page (colours, sizes, margins)?", "CSS", "HTML", "SQL", "JSON"],
  ["Welke taal gebruik je om een webpagina op te maken (kleuren, groottes, marges)?", "CSS", "HTML", "SQL", "JSON"]);
q("web", 1, ["¿Qué etiqueta HTML crea un enlace?", "<a>", "<link>", "<href>", "<url>"],
  ["Which HTML tag creates a link?", "<a>", "<link>", "<href>", "<url>"],
  ["Welke HTML-tag maakt een link?", "<a>", "<link>", "<href>", "<url>"]);
q("web", 1, ["¿Qué significa que un diseño web sea «responsive»?", "Que se adapta a pantallas de distintos tamaños", "Que carga siempre más rápido", "Que solo funciona en móviles", "Que no usa imágenes"],
  ["What does it mean for a web design to be “responsive”?", "It adapts to screens of different sizes", "It always loads faster", "It only works on phones", "It uses no images"],
  ["Wat betekent het dat een webontwerp «responsive» is?", "Het past zich aan schermen van verschillende groottes aan", "Het laadt altijd sneller", "Het werkt alleen op telefoons", "Het gebruikt geen afbeeldingen"]);
q("web", 2, ["¿Qué es una API?", "Un conjunto de reglas para que unos programas se comuniquen con otros", "Un tipo de base de datos", "Un navegador web", "Un lenguaje de estilos"],
  ["What is an API?", "A set of rules that lets programs communicate with each other", "A type of database", "A web browser", "A styling language"],
  ["Wat is een API?", "Een set regels waarmee programma's met elkaar communiceren", "Een type database", "Een webbrowser", "Een opmaaktaal"]);
q("web", 2, ["¿Qué código de estado HTTP significa «no encontrado»?", "404", "200", "500", "301"],
  ["Which HTTP status code means “not found”?", "404", "200", "500", "301"],
  ["Welke HTTP-statuscode betekent «niet gevonden»?", "404", "200", "500", "301"]);

// ================= alg · Algoritmos =================
q("alg", 0, ["Un diagrama de flujo sirve para…", "Representar con símbolos los pasos de un algoritmo", "Guardar datos", "Navegar por internet", "Medir la memoria RAM"],
  ["A flowchart is used to…", "Represent the steps of an algorithm with symbols", "Store data", "Browse the internet", "Measure the RAM"],
  ["Een stroomdiagram dient om…", "De stappen van een algoritme met symbolen weer te geven", "Gegevens op te slaan", "Op internet te surfen", "Het RAM te meten"]);
q("alg", 0, ["En un algoritmo, una condición es…", "Una comparación con resultado verdadero o falso que decide qué camino seguir", "Un error del programa", "Un cable", "Un comentario"],
  ["In an algorithm, a condition is…", "A comparison with a true or false result that decides which path to follow", "A program error", "A cable", "A comment"],
  ["In een algoritme is een voorwaarde…", "Een vergelijking met de uitkomst waar of onwaar die bepaalt welk pad je volgt", "Een programmafout", "Een kabel", "Een opmerking"]);
q("alg", 1, ["La búsqueda binaria solo funciona si la lista está…", "Ordenada", "Vacía", "Desordenada", "Formada solo por números pares"],
  ["Binary search only works if the list is…", "Sorted", "Empty", "Unsorted", "Made only of even numbers"],
  ["Binair zoeken werkt alleen als de lijst…", "Gesorteerd is", "Leeg is", "Ongesorteerd is", "Alleen even getallen bevat"]);
q("alg", 1, ["¿Qué algoritmo de ordenación compara elementos vecinos y los intercambia si están en mal orden?", "Burbuja (bubble sort)", "Búsqueda binaria", "Tabla hash", "Recursión"],
  ["Which sorting algorithm compares neighbouring elements and swaps them if they are in the wrong order?", "Bubble sort", "Binary search", "Hash table", "Recursion"],
  ["Welk sorteeralgoritme vergelijkt buurelementen en wisselt ze om als ze in de verkeerde volgorde staan?", "Bubble sort", "Binair zoeken", "Hashtabel", "Recursie"]);
q("alg", 2, ["¿Qué complejidad tiene recorrer una vez una lista de n elementos?", "O(n)", "O(1)", "O(log n)", "O(n²)"],
  ["What is the complexity of going through a list of n elements once?", "O(n)", "O(1)", "O(log n)", "O(n²)"],
  ["Wat is de complexiteit van een lijst met n elementen één keer doorlopen?", "O(n)", "O(1)", "O(log n)", "O(n²)"]);
q("alg", 2, ["¿Qué es la recursión?", "Cuando una función se llama a sí misma hasta llegar a un caso base", "Repetir instrucciones con un bucle for", "Ordenar una lista", "Una variable global"],
  ["What is recursion?", "When a function calls itself until it reaches a base case", "Repeating instructions with a for loop", "Sorting a list", "A global variable"],
  ["Wat is recursie?", "Wanneer een functie zichzelf aanroept tot ze een basisgeval bereikt", "Instructies herhalen met een for-lus", "Een lijst sorteren", "Een globale variabele"]);

// ================= ds · Estructuras de datos =================
q("ds", 0, ["Una cola (queue) funciona así…", "El primero en entrar es el primero en salir (FIFO)", "El último en entrar es el primero en salir", "Los elementos salen al azar", "Solo guarda un dato"],
  ["A queue works like this…", "First in, first out (FIFO)", "Last in, first out", "Elements come out at random", "It only stores one item"],
  ["Een wachtrij (queue) werkt zo…", "Wie het eerst binnenkomt, gaat er het eerst uit (FIFO)", "Wie het laatst binnenkomt, gaat er het eerst uit", "Elementen komen willekeurig eruit", "Ze bewaart maar één gegeven"]);
q("ds", 0, ["¿Qué guarda un diccionario (o mapa)?", "Pares de clave y valor", "Solo números", "Solo texto largo", "Solo imágenes"],
  ["What does a dictionary (or map) store?", "Key and value pairs", "Only numbers", "Only long text", "Only images"],
  ["Wat bewaart een woordenboek (of map)?", "Paren van sleutel en waarde", "Alleen getallen", "Alleen lange tekst", "Alleen afbeeldingen"]);
q("ds", 1, ["Una pila (stack) funciona así…", "El último en entrar es el primero en salir (LIFO)", "El primero en entrar es el primero en salir", "Los elementos salen al azar", "Los elementos salen por orden alfabético"],
  ["A stack works like this…", "Last in, first out (LIFO)", "First in, first out", "Elements come out at random", "Elements come out in alphabetical order"],
  ["Een stapel (stack) werkt zo…", "Wie het laatst binnenkomt, gaat er het eerst uit (LIFO)", "Wie het eerst binnenkomt, gaat er het eerst uit", "Elementen komen willekeurig eruit", "Elementen komen in alfabetische volgorde eruit"]);
q("ds", 1, ["¿Qué estructura usa nodos enlazados uno tras otro mediante punteros?", "Lista enlazada", "Array", "Tupla", "Matriz"],
  ["Which structure uses nodes linked one after another through pointers?", "Linked list", "Array", "Tuple", "Matrix"],
  ["Welke structuur gebruikt knopen die via verwijzingen na elkaar zijn gekoppeld?", "Gekoppelde lijst", "Array", "Tupel", "Matrix"]);
q("ds", 2, ["¿Qué estructura permite buscar por clave en tiempo medio O(1)?", "Tabla hash", "Lista enlazada", "Pila", "Cola"],
  ["Which structure allows searching by key in average O(1) time?", "Hash table", "Linked list", "Stack", "Queue"],
  ["Welke structuur laat zoeken op sleutel toe in gemiddeld O(1) tijd?", "Hashtabel", "Gekoppelde lijst", "Stapel", "Wachtrij"]);
q("ds", 2, ["En un árbol binario, ¿cuántos hijos tiene como máximo cada nodo?", "2", "1", "3", "Los que quiera"],
  ["In a binary tree, how many children can each node have at most?", "2", "1", "3", "As many as it wants"],
  ["Hoeveel kinderen heeft elke knoop hoogstens in een binaire boom?", "2", "1", "3", "Zoveel als hij wil"]);

// ================= db · Bases de datos =================
q("db", 0, ["En una tabla, ¿qué es una fila (registro)?", "Los datos de un elemento concreto", "Un tipo de dato", "Una contraseña", "Una copia de seguridad"],
  ["In a table, what is a row (record)?", "The data of one specific item", "A data type", "A password", "A backup"],
  ["Wat is een rij (record) in een tabel?", "De gegevens van één specifiek item", "Een gegevenstype", "Een wachtwoord", "Een back-up"]);
q("db", 0, ["¿Qué sentencia SQL se usa para leer datos de una tabla?", "SELECT", "INSERT", "DELETE", "CREATE"],
  ["Which SQL statement is used to read data from a table?", "SELECT", "INSERT", "DELETE", "CREATE"],
  ["Welke SQL-instructie gebruik je om gegevens uit een tabel te lezen?", "SELECT", "INSERT", "DELETE", "CREATE"]);
q("db", 1, ["¿Qué hace la cláusula ORDER BY en SQL?", "Ordena los resultados de la consulta", "Filtra las filas", "Borra la tabla", "Une dos tablas"],
  ["What does the ORDER BY clause do in SQL?", "It sorts the results of the query", "It filters the rows", "It deletes the table", "It joins two tables"],
  ["Wat doet de clausule ORDER BY in SQL?", "Ze sorteert de resultaten van de query", "Ze filtert de rijen", "Ze verwijdert de tabel", "Ze koppelt twee tabellen"]);
q("db", 1, ["¿Qué hace WHERE en una consulta SQL?", "Filtra las filas que cumplen una condición", "Ordena los resultados", "Borra la tabla", "Une dos tablas"],
  ["What does WHERE do in an SQL query?", "It filters the rows that meet a condition", "It sorts the results", "It deletes the table", "It joins two tables"],
  ["Wat doet WHERE in een SQL-query?", "Het filtert de rijen die aan een voorwaarde voldoen", "Het sorteert de resultaten", "Het verwijdert de tabel", "Het koppelt twee tabellen"]);
q("db", 2, ["¿Qué ventaja da crear un índice sobre una columna de una tabla?", "Las búsquedas por esa columna son más rápidas", "Los datos quedan cifrados", "Se hace una copia de seguridad automática", "La columna cambia de tipo"],
  ["What advantage does creating an index on a table column give?", "Searches on that column are faster", "The data becomes encrypted", "An automatic backup is made", "The column changes type"],
  ["Welk voordeel geeft het aanmaken van een index op een tabelkolom?", "Zoekopdrachten op die kolom zijn sneller", "De gegevens worden versleuteld", "Er wordt automatisch een back-up gemaakt", "De kolom verandert van type"]);
q("db", 2, ["En una base de datos, ¿qué garantiza la atomicidad de una transacción?", "Que se hace completa o no se hace nada", "Que los datos estén cifrados", "Que la base de datos sea más rápida", "Que no existan copias"],
  ["In a database, what does atomicity of a transaction guarantee?", "That it is done completely or not at all", "That the data is encrypted", "That the database is faster", "That no copies exist"],
  ["Wat garandeert atomiciteit van een transactie in een database?", "Dat ze volledig wordt uitgevoerd of helemaal niet", "Dat de gegevens versleuteld zijn", "Dat de database sneller is", "Dat er geen kopieën bestaan"]);

// ================= sec · Seguridad =================
q("sec", 0, ["¿Cuál es una contraseña segura?", "Una larga, con letras, números y símbolos, y que no uses en otros sitios", "Tu nombre", "12345", "Tu fecha de nacimiento"],
  ["Which is a strong password?", "A long one with letters, numbers and symbols that you don't reuse elsewhere", "Your name", "12345", "Your birth date"],
  ["Welk wachtwoord is sterk?", "Een lang wachtwoord met letters, cijfers en symbolen dat je nergens anders gebruikt", "Je naam", "12345", "Je geboortedatum"]);
q("sec", 0, ["¿Qué es el phishing?", "Engañar con mensajes o webs falsas para que reveles tus datos", "Un tipo de antivirus", "Una copia de seguridad", "Una red wifi"],
  ["What is phishing?", "Tricking you with fake messages or sites into revealing your data", "A type of antivirus", "A backup", "A wifi network"],
  ["Wat is phishing?", "Je met valse berichten of sites misleiden zodat je je gegevens prijsgeeft", "Een type antivirus", "Een back-up", "Een wifi-netwerk"]);
q("sec", 1, ["¿Para qué sirve la verificación en dos pasos (2FA)?", "Para añadir un segundo factor además de la contraseña", "Para acelerar internet", "Para borrar virus", "Para comprimir archivos"],
  ["What is two-step verification (2FA) for?", "To add a second factor besides the password", "To speed up the internet", "To remove viruses", "To compress files"],
  ["Waar dient verificatie in twee stappen (2FA) voor?", "Om naast het wachtwoord een tweede factor toe te voegen", "Om internet te versnellen", "Om virussen te verwijderen", "Om bestanden te comprimeren"]);
q("sec", 1, ["¿Qué es el cifrado?", "Transformar los datos para que solo los lea quien tenga la clave", "Borrar los datos", "Copiar los datos", "Imprimir los datos"],
  ["What is encryption?", "Transforming data so only someone with the key can read it", "Deleting data", "Copying data", "Printing data"],
  ["Wat is versleuteling?", "Gegevens omvormen zodat alleen wie de sleutel heeft ze kan lezen", "Gegevens verwijderen", "Gegevens kopiëren", "Gegevens printen"]);
q("sec", 2, ["¿Qué es una inyección SQL?", "Meter código SQL malicioso en un campo de entrada para manipular la base de datos", "Un virus que estropea la pantalla", "Un fallo del wifi", "Sobrecargar la CPU"],
  ["What is an SQL injection?", "Putting malicious SQL code into an input field to manipulate the database", "A virus that damages the screen", "A wifi failure", "Overloading the CPU"],
  ["Wat is een SQL-injectie?", "Kwaadaardige SQL-code in een invoerveld zetten om de database te manipuleren", "Een virus dat het scherm beschadigt", "Een wifistoring", "De cpu overbelasten"]);
q("sec", 2, ["¿Por qué se guarda el hash de una contraseña y no la contraseña en claro?", "Porque el hash no se puede revertir fácilmente: si hay una filtración, no se ven las contraseñas", "Para que ocupe más espacio", "Para poder enviártela por correo", "Para que no se te olvide"],
  ["Why store the hash of a password instead of the plain password?", "Because a hash can't be easily reversed: if there is a leak, the passwords are not exposed", "To take up more space", "So it can be emailed to you", "So you don't forget it"],
  ["Waarom bewaar je de hash van een wachtwoord en niet het wachtwoord zelf?", "Omdat een hash niet makkelijk terug te draaien is: bij een lek liggen de wachtwoorden niet bloot", "Om meer ruimte in te nemen", "Zodat het naar je gemaild kan worden", "Zodat je het niet vergeet"]);

// ================= git · Git =================
q("git", 0, ["¿Qué es Git?", "Un sistema de control de versiones", "Un lenguaje de programación", "Un navegador web", "Un editor de fotos"],
  ["What is Git?", "A version control system", "A programming language", "A web browser", "A photo editor"],
  ["Wat is Git?", "Een versiebeheersysteem", "Een programmeertaal", "Een webbrowser", "Een fotobewerker"]);
q("git", 0, ["¿Qué hace git commit?", "Guarda una instantánea de los cambios en el historial", "Descarga un repositorio", "Borra el repositorio", "Cambia tu contraseña"],
  ["What does git commit do?", "It saves a snapshot of the changes in the history", "It downloads a repository", "It deletes the repository", "It changes your password"],
  ["Wat doet git commit?", "Het slaat een momentopname van de wijzigingen op in de geschiedenis", "Het downloadt een repository", "Het verwijdert de repository", "Het wijzigt je wachtwoord"]);
q("git", 1, ["¿Qué es una rama (branch) en Git?", "Una línea de desarrollo independiente", "Un tipo de archivo", "Una copia borrada", "Un error"],
  ["What is a branch in Git?", "An independent line of development", "A type of file", "A deleted copy", "An error"],
  ["Wat is een branch in Git?", "Een onafhankelijke ontwikkellijn", "Een type bestand", "Een verwijderde kopie", "Een fout"]);
q("git", 1, ["¿Qué hace git clone?", "Copia un repositorio remoto a tu equipo", "Fusiona dos ramas", "Deshace el último commit", "Borra una rama"],
  ["What does git clone do?", "It copies a remote repository to your machine", "It merges two branches", "It undoes the last commit", "It deletes a branch"],
  ["Wat doet git clone?", "Het kopieert een externe repository naar je computer", "Het voegt twee branches samen", "Het maakt de laatste commit ongedaan", "Het verwijdert een branch"]);
q("git", 2, ["¿Qué hace git merge?", "Une los cambios de una rama en otra", "Borra el historial", "Crea un repositorio nuevo", "Muestra el estado de los archivos"],
  ["What does git merge do?", "It brings the changes of one branch into another", "It deletes the history", "It creates a new repository", "It shows the status of the files"],
  ["Wat doet git merge?", "Het voegt de wijzigingen van de ene branch samen met een andere", "Het wist de geschiedenis", "Het maakt een nieuwe repository", "Het toont de status van de bestanden"]);
q("git", 2, ["¿Qué es un conflicto de merge?", "Cuando dos ramas cambian las mismas líneas y Git no sabe cuál conservar", "Cuando no hay internet", "Cuando el repositorio está vacío", "Cuando hay demasiados commits"],
  ["What is a merge conflict?", "When two branches change the same lines and Git doesn't know which to keep", "When there is no internet", "When the repository is empty", "When there are too many commits"],
  ["Wat is een merge-conflict?", "Wanneer twee branches dezelfde regels wijzigen en Git niet weet welke te behouden", "Wanneer er geen internet is", "Wanneer de repository leeg is", "Wanneer er te veel commits zijn"]);

// ================= ai · Inteligencia artificial =================
q("ai", 0, ["¿Qué es el aprendizaje automático (machine learning)?", "Que un sistema aprenda patrones a partir de datos", "Programar a mano cada regla", "Un tipo de pantalla", "Un cable especial"],
  ["What is machine learning?", "A system learning patterns from data", "Programming every rule by hand", "A type of screen", "A special cable"],
  ["Wat is machine learning?", "Een systeem dat patronen uit gegevens leert", "Elke regel met de hand programmeren", "Een type scherm", "Een speciale kabel"]);
q("ai", 0, ["¿Qué necesita un modelo de IA para aprender?", "Datos de ejemplo", "Solo electricidad", "Un teclado", "Un monitor"],
  ["What does an AI model need in order to learn?", "Example data", "Only electricity", "A keyboard", "A monitor"],
  ["Wat heeft een AI-model nodig om te leren?", "Voorbeeldgegevens", "Alleen elektriciteit", "Een toetsenbord", "Een monitor"]);
q("ai", 1, ["¿Qué es un sesgo (bias) en un modelo de IA?", "Una tendencia injusta heredada de los datos o del diseño", "Una velocidad de cálculo", "Un tipo de GPU", "Un lenguaje de programación"],
  ["What is bias in an AI model?", "An unfair tendency inherited from the data or the design", "A calculation speed", "A type of GPU", "A programming language"],
  ["Wat is bias in een AI-model?", "Een onterechte neiging die uit de gegevens of het ontwerp voortkomt", "Een rekensnelheid", "Een type gpu", "Een programmeertaal"]);
q("ai", 1, ["¿Qué es una red neuronal artificial?", "Un modelo inspirado en el cerebro, formado por capas de neuronas conectadas", "Una red wifi", "Un cable de red", "Un tipo de procesador"],
  ["What is an artificial neural network?", "A brain-inspired model made of layers of connected neurons", "A wifi network", "A network cable", "A type of processor"],
  ["Wat is een kunstmatig neuraal netwerk?", "Een model naar het voorbeeld van de hersenen, opgebouwd uit lagen verbonden neuronen", "Een wifi-netwerk", "Een netwerkkabel", "Een type processor"]);
q("ai", 2, ["¿Qué es el sobreajuste (overfitting)?", "Que el modelo memoriza los datos de entrenamiento y falla con datos nuevos", "Que el modelo es demasiado rápido", "Que el modelo no tiene datos", "Que el modelo se apaga solo"],
  ["What is overfitting?", "The model memorises the training data and fails on new data", "The model is too fast", "The model has no data", "The model switches itself off"],
  ["Wat is overfitting?", "Het model onthoudt de trainingsgegevens en faalt bij nieuwe gegevens", "Het model is te snel", "Het model heeft geen gegevens", "Het model zet zichzelf uit"]);
q("ai", 2, ["¿Para qué se usan los datos de prueba (test) en IA?", "Para evaluar el modelo con datos que no vio al entrenar", "Para entrenarlo más", "Para borrar el modelo", "Para cifrar el modelo"],
  ["What is test data used for in AI?", "To evaluate the model with data it didn't see during training", "To train it more", "To delete the model", "To encrypt the model"],
  ["Waarvoor gebruik je testgegevens in AI?", "Om het model te beoordelen met gegevens die het tijdens het trainen niet zag", "Om het verder te trainen", "Om het model te verwijderen", "Om het model te versleutelen"]);

// ================= pro · Programación =================
q("pro", 0, ["¿Qué es un bucle?", "Una forma de repetir instrucciones varias veces", "Un error del programa", "Un tipo de variable", "Un archivo"],
  ["What is a loop?", "A way to repeat instructions several times", "A program error", "A type of variable", "A file"],
  ["Wat is een lus?", "Een manier om instructies meerdere keren te herhalen", "Een programmafout", "Een type variabele", "Een bestand"]);
q("pro", 0, ["¿Qué es un bug?", "Un error o fallo en el código", "Un lenguaje de programación", "Un cable", "Una memoria"],
  ["What is a bug?", "An error or fault in the code", "A programming language", "A cable", "A memory"],
  ["Wat is een bug?", "Een fout in de code", "Een programmeertaal", "Een kabel", "Een geheugen"]);
q("pro", 1, ["¿Qué es un valor booleano?", "Un valor que solo puede ser verdadero o falso", "Un número con decimales", "Un texto", "Una lista"],
  ["What is a boolean value?", "A value that can only be true or false", "A number with decimals", "A text", "A list"],
  ["Wat is een booleaanse waarde?", "Een waarde die alleen waar of onwaar kan zijn", "Een getal met decimalen", "Een tekst", "Een lijst"]);
q("pro", 1, ["¿Qué significa depurar (debug) un programa?", "Buscar y corregir sus errores", "Escribir comentarios", "Borrar archivos", "Hacerlo ejecutar más rápido"],
  ["What does it mean to debug a program?", "To find and fix its errors", "To write comments", "To delete files", "To make it run faster"],
  ["Wat betekent een programma debuggen?", "De fouten ervan zoeken en herstellen", "Opmerkingen schrijven", "Bestanden verwijderen", "Het sneller laten draaien"]);
q("pro", 2, ["¿Qué es la programación orientada a objetos?", "Organizar el código en objetos que combinan datos y comportamiento", "Programar solo con funciones matemáticas", "Programar sin variables", "Dibujar objetos en pantalla"],
  ["What is object-oriented programming?", "Organising code into objects that combine data and behaviour", "Programming only with mathematical functions", "Programming without variables", "Drawing objects on the screen"],
  ["Wat is objectgericht programmeren?", "De code organiseren in objecten die gegevens en gedrag combineren", "Alleen met wiskundige functies programmeren", "Programmeren zonder variabelen", "Objecten op het scherm tekenen"]);
q("pro", 2, ["¿Qué es un parámetro de una función?", "Un valor de entrada que la función recibe", "El resultado que devuelve", "Un comentario", "El nombre del archivo"],
  ["What is a function parameter?", "An input value the function receives", "The result it returns", "A comment", "The file name"],
  ["Wat is een parameter van een functie?", "Een invoerwaarde die de functie ontvangt", "Het resultaat dat ze teruggeeft", "Een opmerking", "De bestandsnaam"]);

// ================= py · Python (verificadas ejecutando el código) =================
const py = (t, code, ok, bad) => q("py", t, [CODE_ES, ok, ...bad], [CODE_EN, ok, ...bad], [CODE_NL, ok, ...bad], { lang: "py", code });
py(0, "print(2 ** 3)", "8", ["6", "9", "5"]);
py(0, 'print(len("hola"))', "4", ["5", "3", "2"]);
py(1, "print(10 // 3)", "3", ["3.33", "4", "1"]);
py(1, "print(10 % 3)", "1", ["3", "0", "2"]);
py(1, "print([1, 2, 3][-1])", "3", ["1", "2", "Error"]);
py(1, 'print("ab" * 3)', "ababab", ["ab3", "ab ab ab", "Error"]);
py(2, "print(list(range(1, 10, 3)))", "[1, 4, 7]", ["[1, 4, 7, 10]", "[1, 3, 6, 9]", "[3, 6, 9]"]);
py(2, "x = [1, 2, 3]\ny = x\ny.append(4)\nprint(x)", "[1, 2, 3, 4]", ["[1, 2, 3]", "[4]", "Error"]);
py(2, "print(type(3 / 2).__name__)", "float", ["int", "double", "str"]);

// ================= pye · Python (conceptos) =================
q("pye", 0, ["¿Qué tipo de dato es 3.14 en Python?", "float", "int", "str", "bool"],
  ["What data type is 3.14 in Python?", "float", "int", "str", "bool"],
  ["Welk gegevenstype is 3.14 in Python?", "float", "int", "str", "bool"]);
q("pye", 1, ["¿Qué diferencia hay entre una lista y una tupla en Python?", "La lista se puede modificar (mutable) y la tupla no", "La tupla se puede modificar y la lista no", "Son idénticas", "La lista solo guarda números"],
  ["What is the difference between a list and a tuple in Python?", "A list can be modified (mutable) and a tuple cannot", "A tuple can be modified and a list cannot", "They are identical", "A list only stores numbers"],
  ["Wat is het verschil tussen een lijst en een tuple in Python?", "Een lijst kan worden aangepast (muteerbaar), een tuple niet", "Een tuple kan worden aangepast, een lijst niet", "Ze zijn identiek", "Een lijst bevat alleen getallen"]);
q("pye", 1, ["¿Qué estructura de Python guarda pares clave: valor?", "dict", "list", "tuple", "set"],
  ["Which Python structure stores key: value pairs?", "dict", "list", "tuple", "set"],
  ["Welke Python-structuur bewaart sleutel: waarde-paren?", "dict", "list", "tuple", "set"]);
q("pye", 2, ["¿Qué hace «with open(...) as f:» en por qué se recomienda?", "Abre un archivo y lo cierra solo al terminar el bloque", "Borra el archivo al terminar", "Copia el archivo en la nube", "Cifra el archivo"],
  ["What does “with open(...) as f:” do and why is it recommended?", "It opens a file and closes it automatically at the end of the block", "It deletes the file at the end", "It copies the file to the cloud", "It encrypts the file"],
  ["Wat doet «with open(...) as f:» en waarom wordt het aangeraden?", "Het opent een bestand en sluit het automatisch aan het einde van het blok", "Het verwijdert het bestand aan het einde", "Het kopieert het bestand naar de cloud", "Het versleutelt het bestand"]);

// ================= js · JavaScript (verificadas ejecutando el código) =================
const js = (t, code, ok, bad) => q("js", t, [CODE_ES, ok, ...bad], [CODE_EN, ok, ...bad], [CODE_NL, ok, ...bad], { lang: "js", code });
js(0, "console.log(1 + 2);", "3", ["12", "NaN", "undefined"]);
js(0, 'console.log("5" + 3);', "53", ["8", "15", "NaN"]);
js(1, 'console.log("5" - 3);', "2", ["53", "8", "NaN"]);
js(1, "console.log(typeof null);", "object", ["null", "undefined", "number"]);
js(1, "console.log([1, 2, 3].length);", "3", ["2", "4", "undefined"]);
js(2, "console.log(0.1 + 0.2 === 0.3);", "false", ["true", "undefined", "Error"]);
js(2, "console.log([10, 9, 1].sort());", "[1, 10, 9]", ["[1, 9, 10]", "[10, 9, 1]", "[9, 10, 1]"]);
js(2, "console.log(typeof NaN);", "number", ["NaN", "undefined", "object"]);
js(2, "let a = [1, 2, 3];\nlet b = a;\nb.push(4);\nconsole.log(a.length);", "4", ["3", "1", "Error"]);

// ================= jse · JavaScript (conceptos) =================
q("jse", 0, ["¿Qué método de JavaScript busca un elemento de la página por su id?", "document.getElementById()", "document.write()", "console.log()", "window.alert()"],
  ["Which JavaScript method finds an element on the page by its id?", "document.getElementById()", "document.write()", "console.log()", "window.alert()"],
  ["Welke JavaScript-methode zoekt een element op de pagina via zijn id?", "document.getElementById()", "document.write()", "console.log()", "window.alert()"]);
q("jse", 1, ["¿Qué diferencia hay entre let y const?", "const no se puede reasignar; let sí", "let no se puede reasignar; const sí", "Son idénticas", "const solo guarda números"],
  ["What is the difference between let and const?", "const cannot be reassigned; let can", "let cannot be reassigned; const can", "They are identical", "const only stores numbers"],
  ["Wat is het verschil tussen let en const?", "const kun je niet opnieuw toewijzen; let wel", "let kun je niet opnieuw toewijzen; const wel", "Ze zijn identiek", "const bewaart alleen getallen"]);
q("jse", 1, ["¿Qué hace el método push de un array?", "Añade un elemento al final", "Elimina el primer elemento", "Ordena el array", "Invierte el array"],
  ["What does an array's push method do?", "It adds an element at the end", "It removes the first element", "It sorts the array", "It reverses the array"],
  ["Wat doet de methode push van een array?", "Ze voegt een element aan het einde toe", "Ze verwijdert het eerste element", "Ze sorteert de array", "Ze draait de array om"]);
q("jse", 2, ["¿Qué es una promesa (Promise) en JavaScript?", "Un objeto que representa un resultado asíncrono que llegará en el futuro", "Una variable constante", "Un tipo de bucle", "Un comentario especial"],
  ["What is a Promise in JavaScript?", "An object that represents an asynchronous result that will arrive in the future", "A constant variable", "A type of loop", "A special comment"],
  ["Wat is een Promise in JavaScript?", "Een object dat een asynchroon resultaat voorstelt dat later zal komen", "Een constante variabele", "Een type lus", "Een speciale opmerking"]);

// ================= jv · Java =================
q("jv", 0, ["¿Cuál es el punto de entrada de un programa Java?", "public static void main(String[] args)", "start()", "run()", "init()"],
  ["What is the entry point of a Java program?", "public static void main(String[] args)", "start()", "run()", "init()"],
  ["Wat is het startpunt van een Java-programma?", "public static void main(String[] args)", "start()", "run()", "init()"]);
q("jv", 0, ["¿Qué tipo usas en Java para números con decimales?", "double", "int", "boolean", "char"],
  ["Which type do you use in Java for numbers with decimals?", "double", "int", "boolean", "char"],
  ["Welk type gebruik je in Java voor getallen met decimalen?", "double", "int", "boolean", "char"]);
q("jv", 1, ["¿Qué palabra clave declara una clase en Java?", "class", "object", "struct", "define"],
  ["Which keyword declares a class in Java?", "class", "object", "struct", "define"],
  ["Welk sleutelwoord declareert een klasse in Java?", "class", "object", "struct", "define"]);
q("jv", 1, ["¿Qué diferencia hay entre == y equals() al comparar Strings?", "== compara referencias; equals() compara el contenido", "Son idénticos", "equals() compara referencias; == compara el contenido", "Ninguno sirve para Strings"],
  ["What is the difference between == and equals() when comparing Strings?", "== compares references; equals() compares the content", "They are identical", "equals() compares references; == compares the content", "Neither works for Strings"],
  ["Wat is het verschil tussen == en equals() bij het vergelijken van Strings?", "== vergelijkt verwijzingen; equals() vergelijkt de inhoud", "Ze zijn identiek", "equals() vergelijkt verwijzingen; == vergelijkt de inhoud", "Geen van beide werkt voor Strings"]);
q("jv", 1, ["¿Qué imprime este código?<br>int x = 7 / 2;<br>System.out.println(x);", "3", "3.5", "4", "2"],
  ["What does this code print?<br>int x = 7 / 2;<br>System.out.println(x);", "3", "3.5", "4", "2"],
  ["Wat toont deze code?<br>int x = 7 / 2;<br>System.out.println(x);", "3", "3.5", "4", "2"]);
q("jv", 2, ["¿Qué significa que Java sea de tipado estático?", "Que cada variable tiene un tipo fijo, comprobado al compilar", "Que no tiene variables", "Que todo es texto", "Que no necesita compilador"],
  ["What does it mean for Java to be statically typed?", "Every variable has a fixed type, checked at compile time", "It has no variables", "Everything is text", "It needs no compiler"],
  ["Wat betekent het dat Java statisch getypeerd is?", "Elke variabele heeft een vast type dat bij het compileren wordt gecontroleerd", "Er zijn geen variabelen", "Alles is tekst", "Er is geen compiler nodig"]);
q("jv", 2, ["¿Qué hace la palabra clave final en una variable?", "Impide reasignarla después de inicializarla", "La elimina de la memoria", "La hace pública", "La hace estática"],
  ["What does the final keyword do on a variable?", "It prevents reassigning it after it is initialised", "It removes it from memory", "It makes it public", "It makes it static"],
  ["Wat doet het sleutelwoord final bij een variabele?", "Het voorkomt dat je haar opnieuw toewijst nadat ze is geïnitialiseerd", "Het haalt haar uit het geheugen", "Het maakt haar publiek", "Het maakt haar statisch"]);

// ================= jve · Java (más) =================
q("jve", 1, ["¿Qué es una excepción en Java?", "Un evento de error durante la ejecución que se puede capturar", "Un tipo de variable", "Un comentario", "Un paquete"],
  ["What is an exception in Java?", "An error event during execution that can be caught", "A type of variable", "A comment", "A package"],
  ["Wat is een exception in Java?", "Een foutgebeurtenis tijdens het uitvoeren die je kunt opvangen", "Een type variabele", "Een opmerking", "Een pakket"]);
q("jve", 1, ["¿Qué hace break dentro de un bucle?", "Sale del bucle", "Salta a la siguiente iteración", "Reinicia el programa", "Declara una variable"],
  ["What does break do inside a loop?", "It exits the loop", "It skips to the next iteration", "It restarts the program", "It declares a variable"],
  ["Wat doet break binnen een lus?", "Het verlaat de lus", "Het springt naar de volgende iteratie", "Het herstart het programma", "Het declareert een variabele"]);
q("jve", 2, ["¿Qué es la sobrecarga de métodos (overloading)?", "Tener varios métodos con el mismo nombre y distintos parámetros", "Un método que se llama a sí mismo", "Heredar de dos clases a la vez", "Un método privado"],
  ["What is method overloading?", "Having several methods with the same name and different parameters", "A method that calls itself", "Inheriting from two classes at once", "A private method"],
  ["Wat is method overloading?", "Meerdere methoden met dezelfde naam en verschillende parameters hebben", "Een methode die zichzelf aanroept", "Van twee klassen tegelijk erven", "Een private methode"]);

module.exports = Q;
