// stressTest.js
import { safeAsync } from '../TryCatch/safeAsync.js';

const stressMeta = new WeakMap();//to make it GC safe
let stressNodes = null;

export function initStressTest({
  stressBtn,
  taskList,
  count = 1000,
  holdMs = 20000
}) {
  if (!stressBtn || !taskList) return;

  stressBtn.addEventListener('click', safeAsync(async () => {
    console.clear();
    console.log('🧪 Stress test started');

    // Shadow host 
      const stressHost = document.createElement('div');
      stressHost.id = 'stress-shadow-host';

      const shadow = stressHost.attachShadow({ mode: 'open' });///main point

      const style = document.createElement('style');
        style.textContent = `
          .stress-list {
            padding: 0;
            margin: 0;
            list-style: none;
          }
          li {
            padding: 4px;
            opacity: 0.7;
            font-size: 12px;
          }
        `;

        shadow.appendChild(style);


      // container inside shadow
      const ul = document.createElement('ul');
      ul.className = 'stress-list';

      shadow.appendChild(ul);
      taskList.appendChild(stressHost);

      stressNodes = [];


    // 1️--> Create nodes
    for (let i = 0; i < count; i++) {
        const li = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        const span = document.createElement('span');
        span.textContent = 'Stress Task #' + i;

        li.appendChild(checkbox);
        li.appendChild(span);

        stressMeta.set(li, { index: i });

        ul.appendChild(li);   //  shadow container
        stressNodes.push(li);
}


    console.log(`✅ ${count} nodes created`);

    // 2️-->paint + snapshot time
    await new Promise(r => setTimeout(r, holdMs));

    // Destroy
    stressHost.remove();   
    stressNodes = null;

    console.log('💣 Shadow DOM subtree destroyed. Ready for GC.');

  })
);
}
