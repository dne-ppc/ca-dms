import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Settings, Play, Save, Download, Upload, 
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  Clock, Users, Route, Filter, Zap
} from 'lucide-react';

interface Condition {
  id: string;
  name: string;
  conditionType: string;
  operator: string;
  fieldPath: string;
  expectedValue: any;
  isActive: boolean;
  weight: number;
}

interface Action {
  id: string;
  name: string;
  actionType: string;
  targetStepId?: string;
  targetUserId?: string;
  targetRole?: string;
  parameters: Record<string, any>;
  isActive: boolean;
}

interface ConditionGroup {
  id: string;
  name: string;
  description: string;
  logicalOperator: 'and' | 'or' | 'not';
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  evaluationOrder: number;
}

interface EscalationRule {
  id: string;
  name: string;
  triggerAfterHours: number;
  escalationChain: Array<{type: string, userId?: string, role?: string}>;
  businessHoursOnly: boolean;
  maxLevels: number;
  autoApprove: boolean;
}

interface ConditionalWorkflowBuilderProps {
  workflowId: string;
  onSave?: (configuration: any) => void;
  initialConfiguration?: any;
}

export const ConditionalWorkflowBuilder: React.FC<ConditionalWorkflowBuilderProps> = ({
  workflowId,
  onSave,
  initialConfiguration
}) => {
  const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [activeTab, setActiveTab] = useState<'conditions' | 'escalations' | 'preview'>('conditions');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Available options for dropdowns
  const conditionTypes = [
    { value: 'document_field', label: 'Document Field' },
    { value: 'placeholder_value', label: 'Placeholder Value' },
    { value: 'workflow_data', label: 'Workflow Data' },
    { value: 'user_role', label: 'User Role' },
    { value: 'approval_count', label: 'Approval Count' },
    { value: 'document_size', label: 'Document Size' },
    { value: 'date_time', label: 'Date/Time' },
    { value: 'custom_function', label: 'Custom Function' }
  ];

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
    { value: 'in_list', label: 'In List' },
    { value: 'regex_match', label: 'Regex Match' }
  ];

  const actionTypes = [
    { value: 'route_to_step', label: 'Route to Step' },
    { value: 'skip_step', label: 'Skip Step' },
    { value: 'assign_to_user', label: 'Assign to User' },
    { value: 'assign_to_role', label: 'Assign to Role' },
    { value: 'set_priority', label: 'Set Priority' },
    { value: 'send_notification', label: 'Send Notification' },
    { value: 'auto_approve', label: 'Auto Approve' },
    { value: 'escalate', label: 'Escalate' },
    { value: 'set_context_data', label: 'Set Context Data' },
    { value: 'pause_workflow', label: 'Pause Workflow' }
  ];

  useEffect(() => {
    if (initialConfiguration) {
      setConditionGroups(initialConfiguration.conditionGroups || []);
      setEscalationRules(initialConfiguration.escalationRules || []);
    }
  }, [initialConfiguration]);

  // ========================================================================
  // Condition Group Management
  // ========================================================================

  const addConditionGroup = () => {
    const newGroup: ConditionGroup = {
      id: `group-${Date.now()}`,
      name: `Condition Group ${conditionGroups.length + 1}`,
      description: '',
      logicalOperator: 'and',
      conditions: [],
      actions: [],
      isActive: true,
      evaluationOrder: conditionGroups.length
    };

    setConditionGroups([...conditionGroups, newGroup]);
    setSelectedGroup(newGroup.id);
  };

  const updateConditionGroup = (groupId: string, updates: Partial<ConditionGroup>) => {
    setConditionGroups(groups =>
      groups.map(group =>
        group.id === groupId ? { ...group, ...updates } : group
      )
    );
  };

  const deleteConditionGroup = (groupId: string) => {
    setConditionGroups(groups => groups.filter(group => group.id !== groupId));
    if (selectedGroup === groupId) {
      setSelectedGroup(null);
    }
  };

  // ========================================================================
  // Condition Management
  // ========================================================================

  const addCondition = (groupId: string) => {
    const newCondition: Condition = {
      id: `condition-${Date.now()}`,
      name: `Condition ${Date.now()}`,
      conditionType: 'document_field',
      operator: 'equals',
      fieldPath: '',
      expectedValue: '',
      isActive: true,
      weight: 1.0
    };

    updateConditionGroup(groupId, {
      conditions: [
        ...(conditionGroups.find(g => g.id === groupId)?.conditions || []),
        newCondition
      ]
    });
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<Condition>) => {
    const group = conditionGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedConditions = group.conditions.map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    );

    updateConditionGroup(groupId, { conditions: updatedConditions });
  };

  const deleteCondition = (groupId: string, conditionId: string) => {
    const group = conditionGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedConditions = group.conditions.filter(condition => condition.id !== conditionId);
    updateConditionGroup(groupId, { conditions: updatedConditions });
  };

  // ========================================================================
  // Action Management
  // ========================================================================

  const addAction = (groupId: string) => {
    const newAction: Action = {
      id: `action-${Date.now()}`,
      name: `Action ${Date.now()}`,
      actionType: 'send_notification',
      parameters: {},
      isActive: true
    };

    updateConditionGroup(groupId, {
      actions: [
        ...(conditionGroups.find(g => g.id === groupId)?.actions || []),
        newAction
      ]
    });
  };

  const updateAction = (groupId: string, actionId: string, updates: Partial<Action>) => {
    const group = conditionGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedActions = group.actions.map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    );

    updateConditionGroup(groupId, { actions: updatedActions });
  };

  const deleteAction = (groupId: string, actionId: string) => {
    const group = conditionGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedActions = group.actions.filter(action => action.id !== actionId);
    updateConditionGroup(groupId, { actions: updatedActions });
  };

  // ========================================================================
  // Escalation Rule Management
  // ========================================================================

  const addEscalationRule = () => {
    const newRule: EscalationRule = {
      id: `escalation-${Date.now()}`,
      name: `Escalation Rule ${escalationRules.length + 1}`,
      triggerAfterHours: 24,
      escalationChain: [{ type: 'role', role: 'manager' }],
      businessHoursOnly: true,
      maxLevels: 3,
      autoApprove: false
    };

    setEscalationRules([...escalationRules, newRule]);
  };

  const updateEscalationRule = (ruleId: string, updates: Partial<EscalationRule>) => {
    setEscalationRules(rules =>
      rules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    );
  };

  const deleteEscalationRule = (ruleId: string) => {
    setEscalationRules(rules => rules.filter(rule => rule.id !== ruleId));
  };

  // ========================================================================
  // Configuration Management
  // ========================================================================

  const saveConfiguration = () => {
    const configuration = {
      workflowId,
      conditionGroups,
      escalationRules,
      savedAt: new Date().toISOString()
    };

    if (onSave) {
      onSave(configuration);
    }
  };

  const exportConfiguration = () => {
    const configuration = { workflowId, conditionGroups, escalationRules };
    const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-conditions-${workflowId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importConfiguration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.conditionGroups) setConditionGroups(data.conditionGroups);
        if (data.escalationRules) setEscalationRules(data.escalationRules);
      } catch (error) {
        console.error('Failed to import configuration:', error);
      }
    };
    reader.readAsText(file);
  };

  const testConfiguration = async () => {
    setIsTestMode(true);
    
    // Mock test execution
    setTimeout(() => {
      setTestResults({
        success: true,
        evaluatedGroups: conditionGroups.length,
        executedActions: conditionGroups.reduce((sum, g) => sum + g.actions.length, 0),
        errors: [],
        executionTime: Math.random() * 200 + 50
      });
      setIsTestMode(false);
    }, 2000);
  };

  // ========================================================================
  // Render Methods
  // ========================================================================

  const renderConditionGroup = (group: ConditionGroup) => (
    <div key={group.id} className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700"
          >
            {selectedGroup === group.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {group.name}
          </button>
          <span className={`px-2 py-1 text-xs rounded-full ${
            group.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {group.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {group.conditions.length} conditions, {group.actions.length} actions
          </span>
          <button
            onClick={() => deleteConditionGroup(group.id)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedGroup === group.id && (
        <div className="space-y-4">
          {/* Group Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={group.name}
                onChange={(e) => updateConditionGroup(group.id, { name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logical Operator</label>
              <select
                value={group.logicalOperator}
                onChange={(e) => updateConditionGroup(group.id, { logicalOperator: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
                <option value="not">NOT</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Order</label>
              <input
                type="number"
                value={group.evaluationOrder}
                onChange={(e) => updateConditionGroup(group.id, { evaluationOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                min="0"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={group.description}
              onChange={(e) => updateConditionGroup(group.id, { description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={2}
              placeholder="Describe what this condition group does..."
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Conditions</h4>
              <button
                onClick={() => addCondition(group.id)}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Plus className="h-3 w-3" />
                Add Condition
              </button>
            </div>
            
            <div className="space-y-2">
              {group.conditions.map((condition, index) => (
                <div key={condition.id} className="bg-gray-50 p-3 rounded border">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select
                        value={condition.conditionType}
                        onChange={(e) => updateCondition(group.id, condition.id, { conditionType: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        {conditionTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Field Path</label>
                      <input
                        type="text"
                        value={condition.fieldPath}
                        onChange={(e) => updateCondition(group.id, condition.id, { fieldPath: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="e.g., metadata.priority"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Operator</label>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(group.id, condition.id, { operator: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expected Value</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={condition.expectedValue}
                          onChange={(e) => updateCondition(group.id, condition.id, { expectedValue: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="Value to compare"
                        />
                        <button
                          onClick={() => deleteCondition(group.id, condition.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Actions</h4>
              <button
                onClick={() => addAction(group.id)}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus className="h-3 w-3" />
                Add Action
              </button>
            </div>
            
            <div className="space-y-2">
              {group.actions.map((action) => (
                <div key={action.id} className="bg-green-50 p-3 rounded border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Action Type</label>
                      <select
                        value={action.actionType}
                        onChange={(e) => updateAction(group.id, action.id, { actionType: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        {actionTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Target/Value</label>
                      <input
                        type="text"
                        value={action.targetRole || action.targetUserId || ''}
                        onChange={(e) => {
                          if (action.actionType === 'assign_to_role') {
                            updateAction(group.id, action.id, { targetRole: e.target.value });
                          } else if (action.actionType === 'assign_to_user') {
                            updateAction(group.id, action.id, { targetUserId: e.target.value });
                          }
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Target user, role, or value"
                      />
                    </div>
                    
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={action.name}
                        onChange={(e) => updateAction(group.id, action.id, { name: e.target.value })}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Action name"
                      />
                      <button
                        onClick={() => deleteAction(group.id, action.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderEscalationRule = (rule: EscalationRule) => (
    <div key={rule.id} className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
          <input
            type="text"
            value={rule.name}
            onChange={(e) => updateEscalationRule(rule.id, { name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trigger After (Hours)</label>
          <input
            type="number"
            value={rule.triggerAfterHours}
            onChange={(e) => updateEscalationRule(rule.id, { triggerAfterHours: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            min="1"
          />
        </div>
        
        <div className="md:col-span-2">
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule.businessHoursOnly}
                onChange={(e) => updateEscalationRule(rule.id, { businessHoursOnly: e.target.checked })}
              />
              Business Hours Only
            </label>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule.autoApprove}
                onChange={(e) => updateEscalationRule(rule.id, { autoApprove: e.target.checked })}
              />
              Auto-approve After Max Escalation
            </label>
          </div>
        </div>
        
        <div className="md:col-span-2 flex justify-end">
          <button
            onClick={() => deleteEscalationRule(rule.id)}
            className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-4 w-4" />
            Delete Rule
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Conditional Workflow Builder</h2>
          <p className="text-gray-600">Configure IF/THEN logic and escalation rules for workflow {workflowId}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={testConfiguration}
            disabled={isTestMode}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {isTestMode ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isTestMode ? 'Testing...' : 'Test'}
          </button>
          
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 cursor-pointer">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importConfiguration}
            />
          </label>
          
          <button
            onClick={exportConfiguration}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          
          <button
            onClick={saveConfiguration}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Save Configuration
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className={`p-4 rounded-lg mb-6 ${
          testResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {testResults.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <h3 className="font-medium text-gray-900">Configuration Test Results</h3>
          </div>
          
          <div className="text-sm text-gray-700">
            <p>Evaluated Groups: {testResults.evaluatedGroups}</p>
            <p>Executed Actions: {testResults.executedActions}</p>
            <p>Execution Time: {Math.round(testResults.executionTime)}ms</p>
            {testResults.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-700">Errors:</p>
                <ul className="list-disc list-inside">
                  {testResults.errors.map((error: string, index: number) => (
                    <li key={index} className="text-red-600">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('conditions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'conditions'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Filter className="h-4 w-4" />
          Conditions & Actions ({conditionGroups.length})
        </button>
        
        <button
          onClick={() => setActiveTab('escalations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'escalations'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="h-4 w-4" />
          Escalation Rules ({escalationRules.length})
        </button>
        
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'preview'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuration Preview
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'conditions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Condition Groups</h3>
            <button
              onClick={addConditionGroup}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Condition Group
            </button>
          </div>
          
          <div className="space-y-4">
            {conditionGroups.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Condition Groups</h3>
                <p className="text-gray-600 mb-4">Create your first condition group to add IF/THEN logic to your workflow.</p>
                <button
                  onClick={addConditionGroup}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Condition Group
                </button>
              </div>
            ) : (
              conditionGroups.map(renderConditionGroup)
            )}
          </div>
        </div>
      )}

      {activeTab === 'escalations' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Escalation Rules</h3>
            <button
              onClick={addEscalationRule}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Add Escalation Rule
            </button>
          </div>
          
          <div className="space-y-4">
            {escalationRules.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Escalation Rules</h3>
                <p className="text-gray-600 mb-4">Create escalation rules to automatically handle overdue workflow steps.</p>
                <button
                  onClick={addEscalationRule}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Escalation Rule
                </button>
              </div>
            ) : (
              escalationRules.map(renderEscalationRule)
            )}
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Preview</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 overflow-auto">
              {JSON.stringify({ workflowId, conditionGroups, escalationRules }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};