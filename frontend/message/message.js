const statusList = {
    1: "There was no mistake",
    2: "The error was in the parity bit, corrected",
    3: "There was a mistake, corrected",
    4: "There were mistakes, couldn\'t fix",
}

export const message = (original, encoded, corrupted, decoded, errorCount, status) => {
    return `
<div class="message message-${status}">
  <div class="errors_count">Number of errors: ${errorCount}</div>
  
  <div class="comparison">
    <div>
      <div class="comparison__message encoded">
        <div class="title">Sent message: </div>
        <div class="content">${encoded}</div>
      </div>
      <div class="comparison__message corrupted">
        <div class="title">Received message: </div>
        <div class="content">${corrupted}</div>
      </div>
    </div>

    <div>
      <div class="comparison__message original">
        <div class="title">Original message: </div>
        <div class="content">${original}</div>
      </div>
      <div class="comparison__message decoded">
        <div class="title">Decoded message: </div>
        <div class="content">${decoded}</div>
      </div>
    </div>
  </div>
  
  <div class="conclusion">${statusList[status]}</div>
</div>
	`;
}