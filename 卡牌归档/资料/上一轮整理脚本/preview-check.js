
const suits=['heart','diamond','spade','club'];
const labels=['红桃','方块','黑桃','梅花'];
const step=document.getElementById('step');
const count=document.getElementById('count');
function renderHand(){
  const hand=document.getElementById('hand'),gap=Number(step.value),total=Number(count.value);
  hand.replaceChildren();hand.style.width=`${186+(total-1)*gap}px`;
  document.getElementById('stepValue').textContent=`${gap} px`;
  document.getElementById('countValue').textContent=String(total);
  for(let i=0;i<total;i++){
    const image=document.createElement('img');image.src=`四花色样板/186x260/Shan_${suits[i%4]}.png`;
    image.alt=`${labels[i%4]}闪`;image.style.left=`${i*gap}px`;image.style.zIndex=String(i);image.draggable=false;hand.append(image);
  }
}
step.addEventListener('input',renderHand);count.addEventListener('input',renderHand);renderHand();
for(const [control,target] of [['showRank','rank'],['showSuit','suit']]){
  document.getElementById(control).addEventListener('change',event=>{document.getElementById(target).hidden=!event.target.checked;});
}
