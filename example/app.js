import BaseModel from '../compiled/index'

class PostModel extends BaseModel {
  constructor (root) {
    super(root)
    console.log('ROOT.form_data', root.form_data)
    this

    .describeContainer('flow', {
      'additional': 'int.default:5'
    })

    .describeContainer('granded', {
      'token': 'string.default:"qweqw23342d3x"'
    })

    .addContainer('user extends flow', {
      'name as full_name': 'string',
      'pass': 'string'
    }, root.form_data)
    
    .addContainer('post_data extends [flow, granded]', {
      'text as description': 'allow:[null].string.strip:15',
      'is_mine if(&.isMine == true)': 'bool'
    })

    .addModifiersBulk({
      strip: (value, param) => {
        return { value: value.substr(0, param) }
      },
      allow: (value, params) => {
        return { break: params.indexOf(value) >= 0 }
      },
      default: (value, param) => {
        return { value: value || param }
      }
    })
  }

  get isMine () {
    return this.$post_data.is_mine
  }

  create () {
    return this.generateQuery({
      uri: 'http://localhost/api/v2/post',
      method: 'POST',
      container: 'post_data'
    })()
  }

  edit () {
    return this.generateQuery({
      uri: 'http://localhost/api/v2/post',
      method: 'POST',
      container: 'user'
    })()
  }
}

let app = {
  text: 'loredsfgsdf asf asdgsd sdfgs fgdsfgadsrfgadfgsd gsdfg f',
  form_data: {
    name: 'Karen',
    pass: 'qwe123'
  },
  is_mine: false
}

let model = new PostModel(app)

model.containers.post_data.setSource(app)

console.log('tut', model.$post_data)

model.create()
model.edit()

app.text = 'Johny'
app.is_mine = true

model.edit()
model.create()
