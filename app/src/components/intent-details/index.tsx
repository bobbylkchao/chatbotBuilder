import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { useMutation } from '@apollo/client'
import type { TourProps } from 'antd'
import { Form, Input, Radio, Select, Divider, Button, Tour } from 'antd'
import { QuestionCircleOutlined, LoadingOutlined, BulbOutlined } from '@ant-design/icons'
import toast from 'react-hot-toast'
import MDEditor from '@uiw/react-md-editor'
import rehypeSanitize from 'rehype-sanitize'
import { IBotIntents, TBotIntentHandlerType } from '../../context/type'
import { useGlobalStateContext } from '../../context/global-state'
import { Container, LeftContainer, RightContainer, MarkdownEditorContainer, EditorTipsContainer } from './styled'
import CodeEditor, { ICodeEditorRef } from '../code-editor'
import { updateIntentQuery } from '../../misc/apollo-queries/update-intent'
import { createIntentQuery } from '../../misc/apollo-queries/create-intent'
import { deleteIntentQuery } from '../../misc/apollo-queries/delete-intent'
import { decodeBase64Code, encodeBase64Code } from '../../misc/convert-base64'
import Modal from '../modal'
import { LoadingContiner } from '../loading-component'

export interface IIntentDetailsRef {
  onSubmit: () => Promise<boolean>,
  onDelete: () => Promise<boolean>,
  setData: (intent: IBotIntents) => void,
}

const IntentDetails = forwardRef((_, ref): React.ReactElement => {
  const { setUser } = useGlobalStateContext()
  const [isIntentNameModalOpen, setIsIntentNameModalOpen] = useState<boolean>(false)
  const [isRequiredFieldsModalOpen, setIsRequiredFieldsModalOpen] = useState<boolean>(false)
  const [isIntentHandlerTypeModalOpen, setIsIntentHandlerTypeModalOpen] = useState<boolean>(false)
  const [isEditorTipsModalOpen, setIsEditorTipsModalOpen] = useState<boolean>(false)
  const [isIntentDescTipsModalOpen, setIsIntentDescTipsModalOpen] = useState<boolean>(false)
  const [currentIntent, setCurrentIntent] = useState<IBotIntents | undefined>(undefined)
  const codeEditorRef = useRef<ICodeEditorRef | null>(null)
  const [codeLoaded, setCodeLoaded] = useState<boolean>(false)
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false)
  const [tourSteps, setTourSteps] = useState<TourProps['steps'] | undefined>(undefined)
  const tourRefIntentName = useRef(null)
  const tourRefIntentDesc = useRef(null)
  const tourRefIntentType = useRef(null)
  const [handlerContentMarkdown, setHandlerContentMarkdown] = useState<string>('')
  const [form] = Form.useForm()
  const [
    submitUpdateIntentHandler,
    {
      data: submitUpdateIntentHandlerResult,
      loading: submitUpdateIntentHandlerLoading,
      error: submitUpdateIntentHandlerError,
    }
  ] = useMutation(updateIntentQuery)
  const [
    submitCreateIntentHandler,
    {
      data: submitCreateIntentHandlerResult,
      loading: submitCreateIntentHandlerLoading,
    }
  ] = useMutation(createIntentQuery)
  const [
    submitDeleteIntentHandler,
    {
      loading: submitDeleteIntentHandlerLoading,
    }
  ] = useMutation(deleteIntentQuery)

  // Form hook
  const formIntentName: string = Form.useWatch('name', form)
  const formIntentDescription: string = Form.useWatch('description', form)
  const formIntentHandlerType: TBotIntentHandlerType = Form.useWatch('intentHandlerType', form)
  const formIntentHandlerContent: string = Form.useWatch('intentHandlerContent', form)
  const formIntentHandlerGuidelines: string = Form.useWatch('intentHandlerGuidelines', form)
  const formIntentRequiredFields: string = Form.useWatch('requiredFields', form)
  const formIntentEnabled: boolean = Form.useWatch('isEnabled', form)

  useImperativeHandle(ref, () => ({
    setData: (intent: IBotIntents) => {
      form.resetFields()
      form.setFieldsValue(intent)
      if (!intent.id) {
        // create
        form.setFieldsValue({
          'description': '',
          'intentHandlerType': undefined,
          'intentHandlerContent': '',
          'intentHandlerGuidelines': '',
          'isEnabled': true,
        })
        setHandlerContentMarkdown('')
      } else {
        // update
        form.setFieldsValue({
          'intentHandlerType': intent.intentHandler?.type,
          'intentHandlerContent': intent.intentHandler?.content,
          'intentHandlerGuidelines': intent.intentHandler?.guidelines || '',
        })
        setHandlerContentMarkdown(intent.intentHandler?.content || '')
      }
      setCurrentIntent(intent)
      setCodeLoaded(false)
    },
    onSubmit: onFormSubmit,
    onDelete: onFormDelete,
  }))

  useEffect(() => {
    if (!codeLoaded && formIntentHandlerType === 'FUNCTIONAL' && codeEditorRef?.current) {
      const currentCode = decodeBase64Code(formIntentHandlerContent)
      codeEditorRef.current.setValue(currentCode)
      setCodeLoaded(true)
    }
  }, [
    formIntentHandlerType,
    formIntentHandlerContent,
    codeEditorRef?.current,
    setCodeLoaded,
  ])

  const onFormSubmit = async () => {
    form.validateFields()
      .then(async () => {
        let intentHandlerContentDynamic = formIntentHandlerContent
        let intentRequiredFieldsDynamic = null

        if (formIntentHandlerType === 'FUNCTIONAL') {
          const getCodeFromEditor = codeEditorRef?.current?.getValue()
          if (!getCodeFromEditor) {
            return toast.error('Code cannot be empty!')
          }
          const convertCodeToBase64 = encodeBase64Code(getCodeFromEditor)
          if (!convertCodeToBase64) {
            return toast.error('Code conversion failed!')
          }

          intentHandlerContentDynamic = convertCodeToBase64
          intentRequiredFieldsDynamic = formIntentRequiredFields

          form.setFieldsValue({
            'intentHandlerContent': convertCodeToBase64,
          })
        }

        if (formIntentHandlerType === 'NONFUNCTIONAL' && !intentHandlerContentDynamic) {
          return toast.error('Handler content cannot be empty!')
        }

        const intentHandlerGuidelinesDynamic = formIntentHandlerGuidelines || ''
        if (formIntentHandlerType === 'MODELRESPONSE') {
          if (!intentHandlerGuidelinesDynamic) {
            return toast.error('Guidelines cannot be empty!')
          }
        }

        try {
          if (currentIntent?.id) {
            await submitUpdateIntentHandler({
              variables: {
                updateIntentId: currentIntent?.id,
                name: formIntentName,
                description: formIntentDescription,
                requiredFields: intentRequiredFieldsDynamic,
                isEnabled: formIntentEnabled,
                intentHandler: {
                  content: intentHandlerContentDynamic,
                  guidelines: intentHandlerGuidelinesDynamic,
                  type: formIntentHandlerType,
                },
              },
            })
          } else {
            await submitCreateIntentHandler({
              variables: {
                botId: currentIntent?.botId,
                name: formIntentName,
                description: formIntentDescription,
                requiredFields: intentRequiredFieldsDynamic,
                isEnabled: formIntentEnabled,
                intentHandler: {
                  content: intentHandlerContentDynamic,
                  guidelines: intentHandlerGuidelinesDynamic,
                  type: formIntentHandlerType,
                }
              },
            })
          }
        } catch (err: any) {
          const errorMessage = err?.graphQLErrors?.[0]?.message || 
            err?.networkError?.message || 
            `Intent details ${currentIntent?.id ? 'update' : 'create'} failed!`;

          toast.error(errorMessage)
        }
      })
      .catch(_ => {
        toast.error('Form validate failed')
      })
  }

  const onFormDelete = async (): Promise<boolean> => {
    try {
      if (currentIntent?.id) {
        const result = await submitDeleteIntentHandler({
          variables: {
            intentId: currentIntent?.id
          },
        })
        if (result?.data?.deleteIntent) {
          setUser((prevUser) => {
            if (!prevUser) return prevUser;
            return {
              ...prevUser,
              userBots: prevUser.userBots?.map((bot) => ({
                ...bot,
                botIntents: bot.botIntents?.filter(
                  (intent) => intent.id !== currentIntent?.id
                ),
              })),
            };
          })
          toast.success('Intent deleted!')
          return true
        }
      }
      return false
    } catch (err: any) {
      const errorMessage = err?.graphQLErrors?.[0]?.message || 
        err?.networkError?.message || 
        `Intent details ${currentIntent?.id ? 'update' : 'create'} failed!`;
      toast.error(errorMessage)
      return false
    }
  }

  const onHandlerTypeSelectChange = (value: TBotIntentHandlerType) => {
    if (value === 'FUNCTIONAL') {
      form.setFieldsValue({
        'intentHandlerContent': currentIntent?.intentHandler?.content || ''
      })
    }

    if (value === 'NONFUNCTIONAL' && currentIntent?.intentHandler?.type === 'FUNCTIONAL') {
      form.setFieldsValue({
        'intentHandlerContent': ''
      })
    }
  }

  // Update intent
  useEffect(() => {
    if (submitUpdateIntentHandlerResult) {
      setUser((prevUser) => {
        if (!prevUser) return prevUser
        return {
          ...prevUser,
          userBots: prevUser.userBots?.map((bot) => ({
            ...bot,
            botIntents: bot.botIntents?.map((intent) =>
              intent.id === currentIntent?.id
                ? submitUpdateIntentHandlerResult.updateIntent
                : intent
            )
          }))
        }
      })
      toast.success('Intent updated!')
    }
  }, [
    submitUpdateIntentHandlerResult,
    submitUpdateIntentHandlerError,
    submitUpdateIntentHandlerLoading,
  ])

  // Create intent
  useEffect(() => {
    if (submitCreateIntentHandlerResult) {
      setUser((prevUser) => {
        if (!prevUser) return prevUser

        const newIntentData = submitCreateIntentHandlerResult

        let intentHandlerGuidelinesDynamic = formIntentHandlerGuidelines
        if (formIntentHandlerType !== 'MODELRESPONSE') {
          intentHandlerGuidelinesDynamic = ''
        }
  
        const newIntent: IBotIntents = {
          botId: currentIntent?.botId || '',
          id: newIntentData.createIntent.id,
          name: formIntentName,
          description: formIntentDescription,
          isEnabled: formIntentEnabled,
          requiredFields: formIntentRequiredFields,
          intentHandler: {
            id: newIntentData.createIntent.intentHandler.id,
            type: formIntentHandlerType,
            content: formIntentHandlerContent,
            guidelines: intentHandlerGuidelinesDynamic,
            createdAt: newIntentData.createIntent.intentHandler.createdAt,
            updatedAt: newIntentData.createIntent.intentHandler.updatedAt,
          },
          createdAt: newIntentData.createIntent.createdAt,
          updatedAt: newIntentData.createIntent.updatedAt,
        }
  
        return {
          ...prevUser,
          userBots: prevUser.userBots?.map((bot) =>
            bot.id === currentIntent?.botId
              ? {
                  ...bot,
                  botIntents: [...(bot.botIntents || []), newIntent],
                }
              : bot
          ),
        }
      })
      toast.success('Intent created!')
    }
  }, [
    submitCreateIntentHandlerResult,
  ])

  useEffect(() => {
    if (tourRefIntentName && tourRefIntentDesc && tourRefIntentType) {
      setTimeout(() => {
        if (!localStorage.getItem('isIntentDetailsTourCompleted')) {
          setTourSteps([
            {
              title: 'Intent Name',
              description: <div><p>The chatbot will analyze the user's question and match it with the intent name. It is recommended to use the 'Snake Case' naming method and follow a specific pattern for intent names, such as user_action_topic.</p><p>Examples:</p> <pre>user_ask_cancel_booking, user_need_help_with_account</pre></div>,
              target: () => tourRefIntentName.current,
            },
            {
              title: 'Intent Description',
              description: <div><p>The 'Intent Description' serves to guide the model, ensuring it can accurately identify the most relevant intent when matching the user's query.</p><p>Example:</p> <pre>User need to cancel the booking order.</pre></div>,
              target: () => tourRefIntentDesc.current,
            },
            {
              title: 'Intent Handler Type',
              description: <div><p>There are 4 types of intent handler: Non-functional, Functional, Component, and Model Response. Give you the most flexible way to customize the handler. <b>Read Tips to learn more</b>.</p></div>,
              target: () => tourRefIntentType.current
            },
          ])
          setIsTourOpen(true)
          localStorage.setItem('isIntentDetailsTourCompleted', '1')
        }
      }, 500)
    }
  }, [tourRefIntentName, tourRefIntentDesc, tourRefIntentType])

  return (
    <Container>
      {
        (
          submitUpdateIntentHandlerLoading || 
          submitCreateIntentHandlerLoading || 
          submitDeleteIntentHandlerLoading
        ) && (
          <LoadingContiner><LoadingOutlined /></LoadingContiner>
        )
      }
      <LeftContainer>
        <Form
          name='intent-details-form'
          initialValues={currentIntent}
          autoComplete='off'
          layout='vertical'
          style={{
            marginTop: 10,
            width: '100%',
          }}
          form={form}
        >
          <Form.Item
            label='Bot Id'
            name='botId'
          >
            <Input disabled={true}/>
          </Form.Item>

          <Form.Item
            label='Intent Id'
            name='id'
            style={{
              display: currentIntent?.id ? 'block' : 'none'
            }}
          >
            <Input disabled={true}/>
          </Form.Item>

          <Form.Item
            label={
              <span>Intent Name <QuestionCircleOutlined onClick={() => setIsIntentNameModalOpen(true)} title="Tips" ref={tourRefIntentName}/></span>
            }
            name='name'
            rules={[{
              required: true,
              pattern: /^[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)*$/u,
              message: 'Intent name format is incorrect'
            }]}
          >
            <Input
              placeholder='eg. user_ask_cancel_booking'
            />
          </Form.Item>

          <Form.Item
            label={
              <span>Intent Description <QuestionCircleOutlined onClick={() => setIsIntentDescTipsModalOpen(true)} title="Tips" ref={tourRefIntentDesc}/></span>
            }
            name='description'
            rules={[{
              required: true,
              message: 'Intent description cannot be empty'
            }]}
          >
            <Input
              placeholder="eg. The user's intent is to cancel the booking order."
            />
          </Form.Item>

          <Form.Item
            label={
              <span>Intent Handler Type <QuestionCircleOutlined
                onClick={() => setIsIntentHandlerTypeModalOpen(true)}
                title="Tips"
                ref={tourRefIntentType}
              /></span>
            }
            name='intentHandlerType'
            initialValue={currentIntent?.intentHandler?.type}
            rules={[{ required: true, message: 'Please select intent handler type!' }]}
          >
            <Select
              options={[
                { value: 'NONFUNCTIONAL', label: 'NONFUNCTIONAL' },
                { value: 'FUNCTIONAL', label: 'FUNCTIONAL' },
                { value: 'MODELRESPONSE', label: 'MODEL RESPONSE' },
                { value: 'COMPONENT', label: 'COMPONENT', disabled: true },
              ]}
              onChange={(value) => onHandlerTypeSelectChange(value)}
            />
          </Form.Item>

          <Form.Item
            label='Intent Handler Content'
            name='intentHandlerContent'
            style={{
              display: formIntentHandlerType === 'NONFUNCTIONAL' ? 'block' : 'none'
            }}
          >
            <MarkdownEditorContainer>
              <MDEditor
                value={handlerContentMarkdown}
                onChange={(value = '') => {
                  setHandlerContentMarkdown(value)
                  form.setFieldsValue({
                    'intentHandlerContent': value
                  })
                }}
                previewOptions={{
                  rehypePlugins: [[rehypeSanitize]],
                }}
                height={500}
              />
            </MarkdownEditorContainer>
          </Form.Item>

          {
            formIntentHandlerType === 'MODELRESPONSE' && (
              <Form.Item
                label='Intent Handler Guidelines'
                name='intentHandlerGuidelines'
              >
                <Input.TextArea style={{height: 200}}/>
              </Form.Item>
            )
          }

          <Form.Item
            label={
              <span>Required Fields <QuestionCircleOutlined onClick={() => setIsRequiredFieldsModalOpen(true)} title="Tips"/></span>
            }
            name='requiredFields'
            style={{
              display: formIntentHandlerType === 'FUNCTIONAL' ? 'block' : 'none'
            }}
            rules={[{
              required: false,
              pattern: /^([a-zA-Z]+(?:_[a-zA-Z]+)?)(,\s*[a-zA-Z]+(?:_[a-zA-Z]+)?)*$/,
              message: 'Required fields format is incorrect',
            }]}
          >
            <Input.TextArea
              disabled={formIntentHandlerType !== 'FUNCTIONAL'}
            />
          </Form.Item>

          <Form.Item
            label='Status'
            name='isEnabled'
            rules={[{ required: true, message: 'Please select intent status!' }]}
          >
            <Radio.Group>
              <Radio value={true}>Enable</Radio>
              <Radio value={false}>Disable</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </LeftContainer>
      {
        formIntentHandlerType === 'FUNCTIONAL' && (
          <RightContainer>
            <EditorTipsContainer>
              <Button
                type='link'
                onClick={() => setIsEditorTipsModalOpen(true)}
              ><BulbOutlined />Tips: Check out what functions are available for use in the editor.</Button>
            </EditorTipsContainer>
            <CodeEditor
              ref={codeEditorRef}
            />
          </RightContainer>
        )
      }

      <Modal
        title='Intent Name'
        isModalOpen={isIntentNameModalOpen}
        handleCancel={() => setIsIntentNameModalOpen(false)}
        handleOk={() => setIsIntentNameModalOpen(false)}
        disableCancelButton={true}
      >
        <p>The chatbot will analyze the user's question and match it with the intent name. It is recommended to use the "Snake Case" naming method and follow a specific pattern for intent names, such as <i>user_action_topic</i>.</p>
        <p>For example, <i>user_ask_cancel_booking</i> represents a user inquiry about canceling a booking. Following this <i>user_action_topic</i> pattern helps maintain clarity and consistency, making it easier for the chatbot to understand and match the user's intent accurately. Please create new intent names according to this pattern to ensure clear and descriptive intent definitions.</p>
        <p>Some examples of Intent Name: </p>
        <pre>user_ask_cancel_booking, user_ask_weather, ユーザーが予約をキャンセルしようとしている, 사용자_찾다_취소_예약, 用户需要取消预订</pre>
        <p>The intent name can be in <b>any language</b>, such as English, Chinese, Japanese, etc.</p>
      </Modal>

      <Modal
        title='Intent Description'
        isModalOpen={isIntentDescTipsModalOpen}
        handleCancel={() => setIsIntentDescTipsModalOpen(false)}
        handleOk={() => setIsIntentDescTipsModalOpen(false)}
        disableCancelButton={true}
      >
        <p>The "Intent Description" serves to guide the model, ensuring it can accurately identify the most relevant intent when matching the user's query.</p>
        <p>An example of <b>Intent Description</b>: </p>
        <pre>
        Example 1: User need to seek account-related help.
        Example 2: User need to cancel the booking order.
        Example 3: User is interested or have questions about how to run a farm.
        </pre>
      </Modal>

      <Modal
        title='Required Fields'
        isModalOpen={isRequiredFieldsModalOpen}
        handleCancel={() => setIsRequiredFieldsModalOpen(false)}
        handleOk={() => setIsRequiredFieldsModalOpen(false)}
        disableCancelButton={true}
      >
        <p>When the user's intent is clear then required parameters of intent will be checked. This defines the parameters required for each intent, but not all intents require them. For example, when the user asks <i>“I need cancel my booking order”</i>, this intent actually requires parameters, which may be the offer number. If the user does not provide these parameters, the chatbot will automatically ask again until the user provides the required parameters.</p>
        <p>Name your required parameters using "Snake Case" or "Camel Case", e.g. <i>phone_number</i> or <i>phoneNumber</i>. If there are multiple parameters, separate them with commas.</p>
        <p>An example of <b>Required Fields</b>: </p>
        <pre>
        offerNumber, email
        </pre>
        <p>These parameters will also be passed to the <i><b>Functional</b></i> handler. You can get these parameters in your code and process them with your own logic.</p>
        <p>An example of <b>how to get parameters</b> in your code: </p>
        <pre>
          {'return `offerNumber: ${offerNumber}, email: ${email}`'}
        </pre>
      </Modal>

      <Modal
        title='Intent Handler Type'
        isModalOpen={isIntentHandlerTypeModalOpen}
        handleCancel={() => setIsIntentHandlerTypeModalOpen(false)}
        handleOk={() => setIsIntentHandlerTypeModalOpen(false)}
        disableCancelButton={true}
      >
        <p>There are 4 types of intent handler: <i>Non-functional</i>, <i>Functional</i>, <i>Component</i>, and <i>Model Response</i>.</p>
        <p><b>Non-functional</b>, used to directly return your pre-configured answer, can be text, a list, a paragraph. For example, when a user asks "Which hotel is the best in Winnipeg?", you can directly return "The Fort Garry Hotel".</p>
        <p><b>Functional</b>, used to perform additional logic before returning an answer to the user, such as when the user asks: "What's the weather in Winnipeg today?". You need logic to request the weather API to complete the query. In this type, you can write your own code to handle it. In your code you also can directly access the required parameters you configured. The execution of the code will be safe, it will be executed in a separate VM sandbox.</p>
        <p><b>Model Response</b>, It will be combined with the intent handler guidelines and handed over to the model for further processing and generation.</p>
        <p><b>Component</b>, used to return a component and display it to the user. For example, when a user asks "I need help with my account", you can return a "Sign In Form" component to the user, and the user uses the component to complete the login.</p>
      </Modal>

      <Modal
        title='Code Editor'
        isModalOpen={isEditorTipsModalOpen}
        handleCancel={() => setIsEditorTipsModalOpen(false)}
        handleOk={() => setIsEditorTipsModalOpen(false)}
        disableCancelButton={true}
        size='lg'
      >
        <p><b>Introduction:</b></p>
        <p>This is a browser-based code editor. When you save your code, it is converted to Base64 and stored in the database. When a user asks a question and an intent is detected, the system executes the code you wrote. The code runs in a secure sandbox environment with limited permissions and access to predefined functions.</p>
        <Divider />

        <p><b>How to return?</b></p>
        <p>If you want to return, you can use <i><b>return</b></i> directly, for example <code>return 'Bye! Have a nice day!';</code>. If you want to return in stream mode, for example, return multiple messages and users will continue to receive messages on the frontend, please use <code>sendMessage(message: string)</code>, as described below.</p>
        <Divider />

        <p><b>How to access required fields variables?</b></p>
        <p>You can directly access the required fields that you define for your intent. For example, if you define <code>offerNumber</code> and <code>email</code> as required fields, you can use them in your code as shown below:</p>
        <pre>
          const offerNumberFromUserInput = offerNumber;<br/>
          const emailFromUserInput = email;
        </pre>
        <Divider />

        <p><b>Available Functions:</b></p>
        <p>The following functions are currently available in the sandbox:</p>
        <p>1. <b>request</b></p>
        <p>Represents an Express.js Request object. You can use it to access request data, such as query parameters or body content. <a href='https://expressjs.com/en/api.html#req' target='_blank' rel="noreferrer">API Reference Documentation</a>.</p>
        <p>Example:</p>
        <pre>
          const userQuery = request.query.queryString;<br/>
          const host = request.get('Host');<br/>
          const origin = (request?.headers?.origin || request?.headers?.referer) || '';<br/>
          const cookies = request.cookies;
        </pre>
        <Divider/>
        <p>2. <b>response</b></p>
        <p>Represents an Express.js Response object. <a href='https://expressjs.com/en/api.html#res' target='_blank' rel="noreferrer">API Reference Documentation</a>.</p>
        <p>Example:</p>
        <pre>
          response.locals.userName = 'bobby';
        </pre>
        <Divider/>
        <p>3. <b>sendMessage</b></p>
        <p>This function is used to send stream messages to users. Use <code>sendMessage(message: string)</code> to send messages. Users will continue to receive messages on the frontend.</p>
        <p>Example:</p>
        <pre>
          {'sendMessage(\'Please stay with me, I need some time to process your order...\');'}<br/>
          {'// Other logic'}<br/>
          {'// ...'}<br/>
          {'sendMessage(\'Ok, your order has been processed!\');'}
        </pre>
        <Divider/>
        <p>4. <b>fetch</b></p>
        <p>A standard JavaScript Fetch API for making HTTP requests. <a href='https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch' target='_blank' rel="noreferrer">Documentation</a>.</p>
        <p>Example:</p>
        <pre>
        const response = await fetch('https://api.ipify.org?format=json');<br/>
        const result = await response.json();<br/>
        return 'Your IP is: ' + result.ip;
        </pre>
      </Modal>

      <Tour open={isTourOpen} onClose={() => setIsTourOpen(false)} steps={tourSteps} />
    </Container>
  )
})

IntentDetails.displayName = 'IntentDetails'

export default IntentDetails
