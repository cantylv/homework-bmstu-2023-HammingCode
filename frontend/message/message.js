const statusList = {
    1: "Ошибок не было",
    2: "Ошибка была в бите четности, исправлено",
    3: "Была ошибка, исправлено",
    4: "Были ошибки, исправить не удалось",
}

export const message = (original, encoded, corrupted, decoded, errorCount, status) => {
    return `
<div class="message message-${status}">
  <div class="errors_count">Количество ошибок: ${errorCount}</div>
  
  <div class="comparison">
    <div>
      <div class="comparison__message encoded">
        <div class="title">Отправленное сообщение: </div>
        <div class="content">${encoded}</div>
      </div>
      <div class="comparison__message corrupted">
        <div class="title">Полученное сообщение: </div>
        <div class="content">${corrupted}</div>
      </div>
    </div>

    <div>
      <div class="comparison__message original">
        <div class="title">Исходное сообщение: </div>
        <div class="content">${original}</div>
      </div>
      <div class="comparison__message decoded">
        <div class="title">Декодированное сообщение: </div>
        <div class="content">${decoded}</div>
      </div>
    </div>
  </div>
  
  <div class="conclusion">${statusList[status]}</div>
</div>
	`;
}