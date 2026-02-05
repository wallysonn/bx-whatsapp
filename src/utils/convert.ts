interface IParsePhone {
  phone: string
}
interface IParseContact {
  name: string
  phones: IParsePhone[]
}

export class ConvertUtil {
  public static parseToVcard(contacts: IParseContact[]): string {
    let vcard = ''
    contacts.forEach(contact => {
      vcard += `BEGIN:VCARD\nVERSION:3.0\nN:${contact.name}\n`
      contact.phones.forEach(phone => {
        vcard += `TEL;TYPE=CELL:${phone.phone}\n`
      })
      vcard += 'END:VCARD\n'
    })
    return vcard
  }
}
