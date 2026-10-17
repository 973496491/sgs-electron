// Official OL ES6 snapshot fetched 2026-10-08; unchanged methods, mocked dependencies.
// manager offset 20538451; seat updateFigure offset 9880918. No in-game claim.
module.exports = {
  "sha256": "f62c194174dd2ff4531bc44a795616b6a51f449a3c7c2bec5270f390da55f245",
  "managerMethods": "get Figure(){return this.figureValue}SetFigure(t,i=0){this.figureValue=t,this.subFigureValue=i,this.currentFigure.visible=!0,this.selectedFigure=this.figureValue,c1t.IsFigureMode&&this.seat&&this.seat.IsSelf&&!sJt.I().SystemSets.DefaultOpenFigure&&!c1t.IsViewer?(this.setCurrentFigure(this.getFigureSource(0)),this.selectedFigure=0):this.setCurrentFigure(this.getFigureSource(t,i)),XBi.I().RemoveUserOptFigure(),this.layout()}UpdateFigureTex(){this.setCurrentFigure(this.getFigureSource(this.figureValue,this.subFigureValue))}",
  "seatUpdateFigure": "updateFigure(t,i=0){this.figureManager&&(this.figureManager.SetFigure(t,i),this.isShowDDZZgIcon()&&(this.ddzIconZgEff||(this.ddzIconZgEff=new ljt,this.effectSprite.addChild(this.ddzIconZgEff)),this.ddzIconZgEff.InitEffect(\"res/assets/animate/ddz/OL_DiZhu_tishi.sk\",0,!1),this.ddzIconZgEff.scale(.5,.5),this.ddzIconZgEff.playEffect()),this.figureManager&&this.spPosLayout(this.otherTopManager.x,this.otherTopManager.y)),this.bottomManager&&this.bottomManager.SetFigure(t)}"
};
