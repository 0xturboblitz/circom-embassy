import passportData_florent from '../inputs/passportData_florent.json';
import passportData_alexandre from '../inputs/passportData_alexandre.json';
import passportData_eric from '../inputs/passportData_eric.json';


const datas = [passportData_florent, passportData_alexandre, passportData_eric];

datas.forEach(data => {
  console.log('name', data.mrzInfo.secondaryIdentifier);
  // console.log('dataGroupHashes', data.dataGroupHashes.map(d => [d[0], (d[1] as number[]).length]));
  console.log('eContent', data.eContent.length);
  // console.log('encryptedDigest', data.encryptedDigest.length);
})