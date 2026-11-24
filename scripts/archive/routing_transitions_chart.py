import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.family"]="Liberation Serif"
T=[("MODULE(L) → QUIZ(L)",126),("QUIZ(L) → DRIVE(L)",118),("DRIVE(L) → REPEAT(L)",78),("QUIZ(L) → QUIZ(L), retake",74),
("REPEAT(L) → MODULE(L+1)",64),("DRIVE(L) → MODULE(L+1)",41),("REPEAT(L) → REPEAT(L)",33),("MODULE(0) → DRIVE(0), tutorial",21),
("DRIVE(0) → MODULE(1), tutorial",21),("FINAL → CERTIFIED",21),("REPEAT(6) → FINAL",14),("QUIZ(L) → QUIZ_REVIEW(L)",8),
("QUIZ_REVIEW(L) → DRIVE(L)",8),("DRIVE(6) → FINAL",7),("FINAL → FINAL, failed",5)]
U=["FINAL → FINISHED, 3 failed finals"]+[f"{s} → FINISHED, deadline" for s in ["MODULE(0)","DRIVE(0)","MODULE(L)","QUIZ(L)","QUIZ_REVIEW(L)","DRIVE(L)","REPEAT(L)","FINAL"]]
labels=[t for t,_ in T]+U; vals=[v for _,v in T]+[0]*len(U)
fig,ax=plt.subplots(figsize=(8,7.6),dpi=300)
y=list(range(len(labels)))[::-1]
ax.barh(y[:15],vals[:15],height=0.62,color="#223864")
for yi,v in zip(y[:15],vals[:15]): ax.text(v+1.5,yi,str(v),va="center",fontsize=10,color="#222")
for yi in y[15:]: ax.text(1.5,yi,"not taken",va="center",fontsize=9.5,color="#888",style="italic")
ax.set_yticks(y); ax.set_yticklabels(labels,fontsize=10)
for t in ax.get_yticklabels()[15:]: t.set_color("#888")
sep=(y[14]+y[15])/2; ax.axhline(sep,color="#bbb",lw=0.8,ls="--")
ax.text(138,sep+0.45,"Taken: 15 ↑",ha="right",va="center",fontsize=10,weight="bold")
ax.text(138,sep-0.5,"Not taken: 9 ↓",ha="right",va="center",fontsize=10,weight="bold",color="#777")
ax.set_ylim(-0.8,len(labels)-0.4)
ax.set_title("Routing FSM: 15 of 24 allowed transitions taken (62.5% coverage)",fontsize=12,loc="left")
ax.set_xlim(0,140); ax.set_xlabel("Times taken (21 participants)",fontsize=10.5)
for s in ("top","right"): ax.spines[s].set_visible(False)
ax.spines["left"].set_color("#999"); ax.spines["bottom"].set_color("#999")
ax.tick_params(axis="y",length=0); ax.grid(axis="x",color="#eee"); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig("Figure_Routing_Transitions.png",facecolor="white")
