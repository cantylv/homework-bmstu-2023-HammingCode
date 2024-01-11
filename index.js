const express = require("express"); // импорт библиотеки express
const path = require("path"); // импорт библиотеки path для работы с путями

const app = express();
const PORT = 3000;

const MAX_RESPONSE_TIMEOUT = 2500; // если timeout будет больше, то мы отправим 502 ошибку
const MAX_TIMEOUT = 3000; // максимальное время ожидания ответа
const MIN_TIMEOUT = 500; // минимальное время ожидания

app.use(express.static(path.join(__dirname, "frontend")));

// по корневому запросу отдаем файл index.html из папки ./frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/frontend/index.html"));
});


// ручка, за которую мы будем дергать бэк, чтобы получить сообщение
// описание long polling запроса
app.get("/long-polling-request", (req, res) => {
    // Информационная часть
    const MAX_VALUE = 255; // максимальное значение случайного числа
    const MIN_VALUE = 0; // минимальное значение случайного числа

    // выбирается случайное число из отрезка [MIN_VALUE, MAX_VALUE],
    // представляется в двоичном виде - сообщение, которое мы будем кодировать
    const value = Math.round((MAX_VALUE - MIN_VALUE) * Math.random() + MIN_VALUE);
    console.log('Кодируемое значение: ', value);

    // Получили кол-во бит информации, которую нужно закодировать
    let DATA_LEN = Math.ceil(Math.log2(value + 1));
    if (DATA_LEN === 0) {
        DATA_LEN = 1;
    }
    console.log('Длина информационного сообщения: ', DATA_LEN);

    // Нужно посчитать кол-во контрольных бит, необходимое для кодирования сообщения
    let COUNT_CONTROL_BIT = 2;
    while (true) {
        if (COUNT_CONTROL_BIT >= Math.log2(COUNT_CONTROL_BIT + DATA_LEN + 1)) {
            break;
        }
        ++COUNT_CONTROL_BIT;
    }
    console.log('Количество контрольных битов: ', COUNT_CONTROL_BIT)

    let original = value.toString(2);
    console.log('Двоичное представление кодируемого значения: ', original);

    let ENCODED_MESSAGE_LEN = COUNT_CONTROL_BIT + DATA_LEN;

    // находим закодированное сообщение из original
    let encoded = EncodeMsg(original, ENCODED_MESSAGE_LEN, COUNT_CONTROL_BIT);

    // добавим бит четности, для определения кол-ва ошибок | бит четности - бит, дополняющий кол-во единичных битов до
    // четности, если единиц четное кол-во, поставим 0, иначе 1
    let evenBits = 0
    for (let j = 0; j < ENCODED_MESSAGE_LEN;) {
        if (encoded[j] === '1') {
            ++evenBits;
        }
        ++j;
    }
    encoded += evenBits % 2 ? '1' : '0'
    console.log('Двоичное представление закодированного значения (последний бит - бит четности): ', encoded);

    // добавили бит четности
    ++ENCODED_MESSAGE_LEN;

    // рандомим количество ошибок (от 0 до 2)
    let errorCount = Math.round(Math.random() * 2);

    // копируем закодированное сообщение, чтобы потом "портить" его копию
    let corrupted = encoded;

    // для одной ошибки
    if (errorCount === 1) {
        corrupted = makeOneErr(corrupted, ENCODED_MESSAGE_LEN);
    }

    // для двух ошибок
    if (errorCount === 2) {
        corrupted = makeTwoErr(corrupted, ENCODED_MESSAGE_LEN);
    }

    console.log('Двоичное представление закодированного попорченного значения: ', corrupted);
    console.log('Количество сгенерированных ошибок:', errorCount);

    // выбирается случайное время ожидания из отрезка [500, 3000] - время ответа
    const timeout = Math.round(
        (MAX_TIMEOUT - MIN_TIMEOUT) * Math.random() + MIN_TIMEOUT
    );

    // timeout для ответа
    setTimeout(() => {
        if (timeout > MAX_RESPONSE_TIMEOUT) {
            res.sendStatus(502);
        } else {
            res.send({
                originalPoly: original,		// for example: 1010
                encodedPoly: encoded,			// for example: 1010011
                corruptedPoly: corrupted,	// for example: 1010010
                errorCount: errorCount,		// for example: 1
            });
        }
    }, Math.min(timeout, MAX_RESPONSE_TIMEOUT));
});

// запуск сервера приложения
app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
});

// функция получения остатка
const EncodeMsg = (data, ENCODED_MESSAGE_LEN, COUNT_CONTROL_BIT) => {
    // Расстановка контрольных битов на позициях степеней двойки
    let encodedMessage = "";
    let dataIndex = 0;
    for (let i = 1; i <= ENCODED_MESSAGE_LEN; i++) {
        if (Math.log2(i) % 1 === 0) {
            encodedMessage += "0"; // Инициализация контрольного бита нулем
        } else {
            encodedMessage += data[dataIndex++];
        }
    }

    // Расчет значений контрольных битов
    for (let i = 0; i < COUNT_CONTROL_BIT; i++) {
        const controlBitPosition = Math.pow(2, i) - 1;  // контрольные биты на позициях (0,1,3) | по алгоритму кб стоят на индексах = 2^n
        const controlBitJump = controlBitPosition + 2;  // хоп на следующий захватываемый элемент
        const seqBits = Math.pow(2, i);
        let sum = 0;
        let k = 0; // счетчик, который будем переключать значение j, если он прошел последовательность битов
        for (let j = controlBitPosition; j < ENCODED_MESSAGE_LEN;) {
            if (encodedMessage[j] !== "0") {
                sum += 1;
            }
            k++;
            if (k === seqBits) {
                j += controlBitJump;
                k = 0;
            } else {
                j++;
            }
        }
        if (sum % 2 === 1) {
            encodedMessage = encodedMessage.slice(0, controlBitPosition) + "1" + encodedMessage.slice(controlBitPosition + 1);
        }
    }
    return encodedMessage;
};


const makeOneErr = (corrupted, ENCODED_MESSAGE_LEN) => {
    // рандомим позицию ошибки
    let errIndex = Math.round(Math.random() * (ENCODED_MESSAGE_LEN - 1));

    // строки в js неизменяемы, нужно перегонять в массив
    const encodedArr = corrupted.split("");

    // меняем бит на противоположный
    encodedArr[errIndex] = encodedArr[errIndex] === "0" ? "1" : "0";

    // собираем обратно в строку
    corrupted = encodedArr.join("");

    return corrupted;
};

const makeTwoErr = (corrupted, ENCODED_MESSAGE_LEN) => {
    let errIndex_1 = Math.round(Math.random() * (ENCODED_MESSAGE_LEN - 1));
    let errIndex_2 = Math.round(Math.random() * (ENCODED_MESSAGE_LEN - 1));
    // в цикле проверяем, чтобы позиции ошибок были разные
    for (; errIndex_2 === errIndex_1;) {
        errIndex_2 = Math.round(Math.random() * (ENCODED_MESSAGE_LEN - 1));
    }

    const encodedArr = corrupted.split("");

    encodedArr[errIndex_1] = encodedArr[errIndex_1] === "0" ? "1" : "0";
    encodedArr[errIndex_2] = encodedArr[errIndex_2] === "0" ? "1" : "0";

    corrupted = encodedArr.join("");

    return corrupted;
};