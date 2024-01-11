import {message} from "./message/message.js";

const list = document.getElementById("list"); // список ответов от сервера
const startButton = document.getElementById("start"); // кнопка запуска long polling запросов
const finishButton = document.getElementById("finish"); // кнопка завершения long polling запросов
let isPolling = false; // текущее состояние запросов

let corruptedPoly; // попорченное сообщение
let encodedPoly;  // закодированное сообщение
let errorCount;  // кол-во ошибок
let originalPoly;  // оригинальное сообщение

const longPollingRequest = async () => {
    try {
        const response = await fetch("/long-polling-request");

        const div = document.createElement("div");
        div.style.marginBottom = "1em";

        if (response.status === 200) {
            const data = await response.json();
            div.innerHTML = decoding(data);
        } else if (response.status === 502) {
            div.innerText = `Server is not responding. Error 502. Trying to connect once more.`;
        }

        list.appendChild(div);

        // если соединение еще не прервано, то рекурсивно запускаем функцию
        if (isPolling) {
            longPollingRequest();
        }

    } catch (e) {
        // если в процессе запроса возникла непредвиденная ошибка на сервере, то запускаем функцию через 2,5с
        setTimeout(() => {
            // если соединение еще не прервано, то рекурсивно запускаем функцию
            if (isPolling) {
                longPollingRequest();
            }
        }, 2500);
    }
};

// Если предположить, что количество ошибок - не более двух, то:
// - Данные верны, если во всех контрольных битах значения идентичные, и общее количество единиц - тоже четное.
// - Произошла однократная ошибка, если в некоторых контрольных битах значение поменялось,
//   и общее количество единиц - нечетное.
// - Ошибка в дополнительном контрольном разряде, если во всех контрольных битах значения идентичные,
//   а общее количество единиц - нечетное.
// - Двойная ошибка, если в некоторых контрольных группах количество единиц - нечетное, а общее количество единиц - четное.
const decoding = (data) => {
    // распаковываем ответ
    ({originalPoly, encodedPoly, corruptedPoly, errorCount} = data);

    let ENCODED_MESSAGE_LEN = corruptedPoly.length;  // не забываем про контрольный бит четности
    let COUNT_CONTROL_BIT = ENCODED_MESSAGE_LEN - originalPoly.length - 1;

    console.log('Исходные данные: ', originalPoly)
    console.log('Закодированное сообщение правильное, небитое (последний бит - бит четности): ', encodedPoly)
    console.log('Закодированное сообщение, которое нужно декодировать: ', corruptedPoly)
    console.log('Кол-во ошибок: ', errorCount)
    // должно быть раскодированное сообщение (в хорошем случае - исходное) - похожее на originalPoly
    let [decodedPoly, changeEvenBit, index] = DecodeInternal(corruptedPoly, COUNT_CONTROL_BIT, ENCODED_MESSAGE_LEN);

    console.log('Декодированное сообщение: ', decodedPoly);
    console.log('Не поменялась четность единиц: ', changeEvenBit);

    // значит ошибки не было, либо это был контрольный бит четности
    if (index === 0) {
        // если бит четности не поменялся
        if (changeEvenBit) {
            // ошибок нет
            return message(originalPoly, encodedPoly, corruptedPoly, decodedPoly, errorCount, 1);
        } else {
            // ошибка в бите четности, но он не влияет на информацию закодированную
            return message(originalPoly, encodedPoly, corruptedPoly, decodedPoly, errorCount, 2);
        }
    } else {
        if (decodedPoly === originalPoly && !changeEvenBit) {
            // Ошибка была, но мы ее восстановили
            return message(originalPoly, encodedPoly, corruptedPoly, decodedPoly, errorCount, 3);
        } else {
            // две ошибки
            return message(originalPoly, encodedPoly, corruptedPoly, decodedPoly, errorCount, 4);
        }
    }
}

const DecodeInternal = (encodedMessage, COUNT_CONTROL_BIT, ENCODED_MESSAGE_LEN) => {
    let evenBitsEncoded = encodedMessage[ENCODED_MESSAGE_LEN - 1];
    console.log('Бит четности закодированного сообщения, пришедшего с бека: ', evenBitsEncoded)

    // Найдем бит четности снова, чтобы знать, сколько элементов поменялось (потенциально)
    let evenBitChange = 0
    for (let j = 0; j < encodedMessage.length - 1;) {
        if (encodedMessage[j] === '1') {
            ++evenBitChange;
        }
        ++j;
    }

    console.log('Сколько единичных битов получилось: ', evenBitChange)
    evenBitChange = evenBitChange % 2 ? '1' : '0';
    console.log('Бит четности пересчитанного сообщения, пришедшего с бека: ', evenBitChange)

    console.log('Количество контрольных битов: ', COUNT_CONTROL_BIT);
    console.log('Длина закодированного сообщения без учета четного бита: ', ENCODED_MESSAGE_LEN - 1)

    // нужно будет еще раз закодировать, чтобы сверить контрольные биты и бит четности
    let decodedMessage = "";
    // Расстановка контрольных битов на позициях степеней двойки
    // Длина encodedMessage.length - 1, так как бит четности не входит непосредственно в кодируемые данные
    for (let i = 0; i < ENCODED_MESSAGE_LEN - 1; i++) {
        if (Math.log2(i + 1) % 1 === 0) {
            decodedMessage += '0';
        } else {
            decodedMessage += encodedMessage[i];
        }
    }

    console.log('Сообщение, готовое к подсчету контрольных бит: ', decodedMessage);

    // Расчет значений контрольных битов и проверка ошибок
    for (let i = 0; i < COUNT_CONTROL_BIT; ++i) {
        const controlBitPosition = Math.pow(2, i) - 1;     // контрольные биты на позициях (0,1,3) | по алгоритму кб стоят на индексах = 2^n
        const controlBitJump = controlBitPosition + 2;  // хоп на следующий захватываемый элемент
        const seqBits = Math.pow(2, i);
        let sum = 0;
        let k = 0; // счетчик, который будем переключать значение j, если он прошел последовательность битов
        for (let j = controlBitPosition; j < decodedMessage.length;) {
            if (decodedMessage[j] !== "0") {
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
            decodedMessage = decodedMessage.slice(0, controlBitPosition) + "1" + decodedMessage.slice(controlBitPosition + 1);
        }
    }

    console.log('Закодированное сообщение с пересчитанными контрольными битами без четного бита: ', decodedMessage);


    // получили decodedMessage и encodedMessage, нужно проверить их контрольные биты
    // получим значения тех контрольных битов, которые не совпадают
    let index = 0
    for (let bit = 0; bit < COUNT_CONTROL_BIT; ++bit) {
        let bit_position = Math.pow(2, bit) - 1
        if (decodedMessage[bit_position] !== encodedMessage[bit_position]) {
            index += (bit_position + 1);
        }
    }

    // заменили сидром ошибки --> исправили ошибку у полученного сообщения
    if (index > 0) {
        let bit_invert = index - 1
        console.log('Какой бит пострадал: ', bit_invert);
        if (encodedMessage[bit_invert] === '0')
            encodedMessage = encodedMessage.substring(0, bit_invert) + "1" + encodedMessage.substring(bit_invert + 1);
        else {
            encodedMessage = encodedMessage.substring(0, bit_invert) + "0" + encodedMessage.substring(bit_invert + 1);
        }
    }

    console.log('Исправленное закодированное сообщение: ', encodedMessage);

    // нужно получить декодированные данные | Примечание: декодированное сообщение не содержит бит четности
    let decoded_data = ""
    for (let i = 0; i < encodedMessage.length - 1; ++i) {
        if (Math.log2(i + 1) % 1 !== 0) {
            decoded_data += encodedMessage[i]
        }
    }

    console.log('Раскодированное сообщение: ', decoded_data);

    // Если второй элемент в списке будет False, значит у нас точно были ошибки
    return [decoded_data, evenBitChange === evenBitsEncoded, index]
};


// функция вызывается при нажатии на кнопку "начать"
const startConnectToServer = () => {
    finishButton.disabled = false;
    startButton.disabled = true;
    isPolling = true;

    longPollingRequest();
};

// функция вызывается при нажатии на кнопку "закончить"
const finishConnectToServer = () => {
    startButton.disabled = false;
    finishButton.disabled = true;
    isPolling = false;
};

startButton.addEventListener("click", startConnectToServer);
finishButton.addEventListener("click", finishConnectToServer);