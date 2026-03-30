from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json, math, traceback

try:
    import swisseph as swe
    HAS_SWE = True
except ImportError:
    HAS_SWE = False

OBL=23.4365; DEG=math.pi/180
def R(d): return d*DEG
def n360(x): return ((x%360)+360)%360
def n180(x): return ((x+540)%360)-180

def gmst(jd):
    T=(jd-2451545.0)/36525.0
    return n360(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000.0)

def lon_to_ra_dec(lon,obl=OBL):
    l=R(lon); e=R(obl)
    ra=n360(math.atan2(math.sin(l)*math.cos(e),math.cos(l))*180/math.pi)
    dec=math.asin(math.sin(e)*math.sin(l))*180/math.pi
    return ra,dec

def make_lines(ra,dec,G):
    dr=R(dec); mc_lon=n180(ra-G); ic_lon=n180(mc_lon+180)
    mc,ic,asc,dsc=[],[],[],[]
    for lat in range(-89,90): mc.append([lat,mc_lon]); ic.append([lat,ic_lon])
    for lat in range(-89,90):
        ch=-math.tan(R(lat))*math.tan(dr)
        if abs(ch)>1: continue
        H=math.acos(max(-1,min(1,ch)))*180/math.pi
        asc.append([lat,n180(ra-H-G)]); dsc.append([lat,n180(ra+H-G)])
    return {'MC':mc,'IC':ic,'ASC':asc,'DSC':dsc,'mcLon':mc_lon,'ra':ra,'dec':dec}

def build_acg_swe(jd):
    G=gmst(jd)
    PLANETS={'Sun':swe.SUN,'Moon':swe.MOON,'Mercury':swe.MERCURY,
             'Venus':swe.VENUS,'Mars':swe.MARS,'Jupiter':swe.JUPITER,
             'Saturn':swe.SATURN,'Uranus':swe.URANUS,'Neptune':swe.NEPTUNE,'Pluto':swe.PLUTO}
    # Use Moshier ephemeris (built-in, no data files needed) + equatorial coords
    # SEFLG_MOSEPH=4, SEFLG_SPEED=256, SEFLG_EQUATORIAL=2048
    IFLAG = 4 | 256 | 2048
    lines={}
    for name,pid in PLANETS.items():
        try:
            r,_=swe.calc_ut(jd,pid,IFLAG)
            ra=r[0]   # right ascension in degrees
            dec=r[1]  # declination in degrees
        except:
            continue
        lines[name]=make_lines(ra,dec,G)
    return lines

S=1e-8
def vs(t,tau): return sum(v[0]*math.cos(v[1]+v[2]*tau) for v in t)
def helio(L0,L1,L2,B0,B1,R0,R1,tau):
    L=vs(L0,tau)+vs(L1,tau)*tau+(vs(L2,tau)*tau*tau if L2 else 0)
    B=vs(B0,tau)+(vs(B1,tau)*tau if B1 else 0); Rv=vs(R0,tau)+vs(R1,tau)*tau
    return [Rv*math.cos(B)*math.cos(L),Rv*math.cos(B)*math.sin(L),Rv*math.sin(B)]
def gL(p,e): return n360(math.atan2(p[1]-e[1],p[0]-e[0])*180/math.pi)
def kepler(M,e):
    E=M
    for _ in range(10):
        d=E-e*math.sin(E)-M; E-=d/(1-e*math.cos(E))
        if abs(d)<1e-10: break
    return E
def kG(L0r,Lr,e0r,er,w0r,wr,i0r,ir,O0r,Or,ar,jd,ex,ey):
    T=(jd-2451545)/36525; L=n360(L0r+Lr*T); e=e0r+er*T; w=n360(w0r+wr*T)
    i=R(i0r+ir*T); O=R(O0r+Or*T); M=R(n360(L-w)); E=kepler(M,e)
    nu=2*math.atan2(math.sqrt(1+e)*math.sin(E/2),math.sqrt(1-e)*math.cos(E/2))
    r=ar*(1-e*math.cos(E)); sm=R(w)-O; u=nu+sm
    x=r*(math.cos(O)*math.cos(u)-math.sin(O)*math.sin(u)*math.cos(i))
    y=r*(math.sin(O)*math.cos(u)+math.cos(O)*math.sin(u)*math.cos(i))
    return n360(math.atan2(y-ey,x-ex)*180/math.pi)
def sL(jd):
    T=(jd-2451545)/36525; L0=n360(280.46646+36000.76983*T)
    M=n360(357.52911+35999.05029*T-.0001537*T*T); Mr=R(M)
    return n360(L0+(1.914602-.004817*T-.000014*T*T)*math.sin(Mr)+(0.019993-.000101*T)*math.sin(2*Mr)+.000289*math.sin(3*Mr))
def mL(jd):
    T=(jd-2451545)/36525; L0=n360(218.3165+481267.8813*T); M=n360(357.5291+35999.0503*T)
    Mp=n360(134.9634+477198.8676*T); D=n360(297.8502+445267.1115*T); F=n360(93.2721+483202.0175*T)
    return n360(L0+6.2888*math.sin(R(Mp))+1.274*math.sin(R(2*D-Mp))+.6583*math.sin(R(2*D))+.2136*math.sin(R(2*Mp))-.1851*math.sin(R(M))-.1143*math.sin(R(2*F))+.0588*math.sin(R(2*D-2*Mp))+.0572*math.sin(R(2*D-M-Mp))+.0533*math.sin(R(2*D+Mp)))

EL0=[[175347046*S,0,0],[3341656*S,4.6732156,6283.075850],[34894*S,4.62610,12566.15170],[3497*S,2.7441,5753.3849],[3418*S,2.8289,3.5231],[3136*S,3.6277,77713.7715],[2676*S,4.4181,7860.4194],[2343*S,6.1352,3930.2097],[1324*S,0.7425,11506.7698],[1273*S,2.0371,529.6910]]
EL1=[[628331966747*S,0,0],[206059*S,2.678235,6283.075850],[4303*S,2.6351,12566.1517],[425*S,1.590,3.523],[119*S,5.796,26.298],[109*S,2.966,1577.344]]
EL2=[[52919*S,0,0],[8720*S,1.0721,6283.0758],[309*S,0.867,12566.152]]
EB0=[[280*S,3.199,84334.662],[102*S,5.422,5507.553],[80*S,3.88,5223.69]]
ER0=[[100013989*S,0,0],[1670700*S,3.0984635,6283.075850],[13956*S,3.05525,12566.15170],[3084*S,5.1985,77713.7715],[1628*S,1.1739,5753.3849],[1576*S,2.8469,7860.4194]]
ER1=[[103019*S,1.107490,6283.075850],[1721*S,1.0644,12566.1517]]
VL0=[[317614667*S,0,0],[1353968*S,5.5931332,10213.2855462],[89892*S,5.30650,20426.57109],[5477*S,4.4163,7860.4194],[3456*S,2.6996,11790.6291],[2372*S,2.9938,3930.2097],[1664*S,4.2502,1577.3435],[1438*S,4.1575,9683.5946]]
VL1=[[1021352943052*S,0,0],[95708*S,2.46424,10213.28555],[14445*S,0.51625,20426.57109]]
VL2=[[54127*S,0,0],[3891*S,0.3451,10213.2855]]
VB0=[[5923638*S,0.2670278,10213.2855462],[40108*S,1.14737,20426.57109],[32815*S,3.14159,0]]
VB1=[[513348*S,1.803643,10213.285546],[199*S,0,0]]
VR0=[[72333282*S,0,0],[489824*S,4.021518,10213.285546],[1658*S,4.9021,20426.5711]]
VR1=[[34551*S,0.89199,10213.28555]]
MaL0=[[620347712*S,0,0],[18656368*S,5.0503417,3340.6124267],[1108217*S,5.4009984,6681.2248534],[91798*S,5.7547,10021.8373],[27745*S,5.9705,2281.2305],[12316*S,0.8496,2810.9215],[10610*S,2.9396,2942.4634],[8927*S,4.1578,0.0173],[8716*S,6.1101,13362.4497]]
MaL1=[[334085627154*S,0,0],[1458227*S,3.6042605,3340.6124267],[164901*S,3.9263,6681.2249],[19963*S,4.2660,10021.8373],[3452*S,4.7321,3337.0893]]
MaL2=[[58016*S,2.0498,3340.6124],[54188*S,0,0],[13908*S,2.4574,6681.2248]]
MaB0=[[3197135*S,3.7683204,3340.6124267],[298033*S,4.1061,6681.2249],[289105*S,3.14159,0],[31366*S,4.4465,10021.8373]]
MaB1=[[350069*S,5.368478,3340.612427],[14116*S,3.14159,0],[9671*S,5.4788,6681.2249]]
MaR0=[[153033488*S,0,0],[14184953*S,3.47971,3340.6124267],[660776*S,3.817834,6681.224853],[46179*S,4.15595,10021.83728],[8110*S,5.5596,2810.9215]]
MaR1=[[1107433*S,2.03253,3340.6124267],[103176*S,2.37072,6681.224853],[12877*S,0,0]]
JuL0=[[59954691*S,0,0],[9695899*S,5.0619179,529.6909651],[573610*S,1.44406,7.11355],[306389*S,5.41734,1059.38193],[97178*S,4.14265,632.78374],[72903*S,3.64042,522.57742],[64264*S,3.41145,103.09277]]
JuL1=[[52993480757*S,0,0],[489741*S,4.22067,529.690965],[228919*S,6.02648,7.11355],[55733*S,0.24322,1059.38193]]
JuL2=[[47234*S,4.32148,7.11355],[38966*S,0,0],[30629*S,2.93021,529.69097]]
JuB0=[[2268616*S,3.5585261,529.6909651],[110090*S,0,0],[109972*S,3.908093,1059.381930]]
JuB1=[[177352*S,5.701665,529.690965]]
JuR0=[[520887429*S,0,0],[25209327*S,3.49108640,529.6909651],[610600*S,3.841154,1059.38193],[282029*S,2.574199,632.78374]]
JuR1=[[1271802*S,2.649375,529.6909651],[61662*S,3.000992,1059.38193],[53444*S,3.890718,522.57742],[41390*S,0,0]]
SaL0=[[87401354*S,0,0],[11107660*S,3.9620509,213.2990954],[1414151*S,4.5858152,7.1135470],[398379*S,0.52112,206.18555],[350769*S,3.30330,426.59819],[206816*S,0.24658,103.09277]]
SaL1=[[21354295596*S,0,0],[1296855*S,1.82821,213.29910],[564348*S,2.88500,7.11355],[107679*S,2.27770,206.18555],[98323*S,1.08087,426.59819]]
SaL2=[[116441*S,1.17988,7.11355],[91921*S,0.07325,213.29910],[90592*S,0,0],[15277*S,4.06492,206.18555]]
SaB0=[[4330678*S,3.6028443,213.2990954],[240348*S,2.852385,426.598191],[84746*S,0,0]]
SaB1=[[397555*S,5.332900,213.299095],[49479*S,3.14159,0]]
SaR0=[[955758136*S,0,0],[52921382*S,2.39226220,213.2990954],[1873680*S,5.235496,206.18555],[1464664*S,1.647631,426.59819]]
SaR1=[[6182981*S,0.2584352,213.2990954],[506578*S,0.711147,206.18555],[341394*S,5.796358,426.59819],[188491*S,0.472157,220.41264]]
UrL0=[[548129294*S,0,0],[9260408*S,0.8910642,74.7815986],[1504248*S,3.6271490,1.4844727],[365982*S,1.899715,73.2971259],[272328*S,3.358255,149.5631971]]
UrL1=[[7502543122*S,0,0],[154458*S,5.242017,74.781599],[24456*S,1.71256,1.48447]]
UrL2=[[53033*S,0,0],[16983*S,3.16565,138.5175],[9987*S,5.9491,74.7816]]
UrB0=[[1346278*S,2.6187781,74.7815986],[62341*S,5.08111,149.5632],[61601*S,3.14159,0]]
UrB1=[[206366*S,4.12394,74.78160]]
UrR0=[[1921264848*S,0,0],[88784984*S,5.60377527,74.7815986],[3440835*S,0.32836,73.2971259],[2055653*S,1.78295,149.5631971]]
UrR1=[[1479896*S,3.6720571,74.7815986],[71212*S,6.22815,63.73590]]
NeL0=[[531188633*S,0,0],[1798476*S,2.9010127,38.1330356],[1019728*S,0.4858092,1.4844727],[124532*S,4.830081,36.6485629]]
NeL1=[[3837687717*S,0,0],[16604*S,4.86319,1.48447],[15807*S,2.27923,38.13304]]
NeL2=[[53892*S,0,0],[296*S,1.855,1.48447]]
NeB0=[[3088623*S,1.4410437,38.1330356],[27701*S,5.909627,76.2660712],[27237*S,3.14159,0]]
NeB1=[[227279*S,3.807931,38.133035],[2721*S,3.14159,0]]
NeR0=[[3007013206*S,0,0],[27062259*S,1.32999459,38.1330356],[1691764*S,3.2518614,36.6485629]]
NeR1=[[236339*S,0.70498,38.133035]]

def build_acg_vsop87(jd):
    G=gmst(jd); tau=(jd-2451545)/365250
    E=helio(EL0,EL1,EL2,EB0,None,ER0,ER1,tau)
    lons={'Sun':sL(jd),'Moon':mL(jd),
        'Mercury':kG(252.250906,149472.6746358,0.20563175,-0.000020407,77.45779628,0.15940013,7.00498625,-0.00594749,48.33076593,-0.12534081,0.387098310,jd,E[0],E[1]),
        'Venus':gL(helio(VL0,VL1,VL2,VB0,VB1,VR0,VR1,tau),E),
        'Mars':gL(helio(MaL0,MaL1,MaL2,MaB0,MaB1,MaR0,MaR1,tau),E),
        'Jupiter':gL(helio(JuL0,JuL1,JuL2,JuB0,JuB1,JuR0,JuR1,tau),E),
        'Saturn':gL(helio(SaL0,SaL1,SaL2,SaB0,SaB1,SaR0,SaR1,tau),E),
        'Uranus':gL(helio(UrL0,UrL1,UrL2,UrB0,UrB1,UrR0,UrR1,tau),E),
        'Neptune':gL(helio(NeL0,NeL1,NeL2,NeB0,NeB1,NeR0,NeR1,tau),E),
        'Pluto':kG(238.929038,145.2078051,0.24880766,0,224.068916,0,17.1410426,0,110.3034700,0,39.48211675,jd,E[0],E[1])}
    lines={}
    for name,lon in lons.items():
        ra,dec=lon_to_ra_dec(lon); lines[name]=make_lines(ra,dec,G)
    return lines

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed=urlparse(self.path); params=parse_qs(parsed.query)
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.send_header('Access-Control-Allow-Origin','*')
        self.end_headers()
        try:
            if 'jd' not in params:
                self.wfile.write(json.dumps({'error':'jd required'}).encode()); return
            jd=float(params['jd'][0])
            if HAS_SWE:
                lines=build_acg_swe(jd); source='swisseph'
            else:
                lines=build_acg_vsop87(jd); source='vsop87'
            self.wfile.write(json.dumps({'lines':lines,'source':source}).encode())
        except Exception as ex:
            self.wfile.write(json.dumps({'error':str(ex),'tb':traceback.format_exc(),'has_swe':HAS_SWE}).encode())
    def log_message(self,format,*args): pass
